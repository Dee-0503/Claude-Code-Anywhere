import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocketServer } from 'ws';

import {
  authenticateWebSocketConnection,
  rejectInvalidWebSocketRequestPolicy,
  type WebSocketAuthenticationOptions
} from './websocket-auth.js';

import type {
  ClientConnection,
  ClaudeInstanceId,
  ConnectionId,
  DeviceId
} from '../../../shared/protocol/domain.js';
import {
  CONNECTION_STATES,
  SERVER_MESSAGE_TYPES,
  type HelloMessagePayload,
  type WebSocketConnectionParams
} from '../../../shared/protocol/messages.js';
import { config, type AppConfig } from '../config.js';
import { invalidRequest } from './errors.js';
import { isNonEmptyString, isNonNegativeInteger } from './validation.js';

export type WebSocketConnectionIdentity = {
  readonly deviceId: DeviceId;
  readonly instanceId: ClaudeInstanceId;
};

export interface RegisteredConnection extends ClientConnection {
  readonly socket: unknown;
}

export class ConnectionRegistry {
  private readonly connections = new Map<ConnectionId, RegisteredConnection>();

  register(
    socket: unknown,
    params: WebSocketConnectionParams,
    now = new Date()
  ): RegisteredConnection {
    const timestamp = now.toISOString();
    const connection: RegisteredConnection = {
      id: randomUUID(),
      deviceId: params.device_id,
      instanceId: params.instance_id,
      state: CONNECTION_STATES.CONNECTED,
      connectedAt: timestamp,
      lastSeenAt: timestamp,
      lastOutputOffset: params.last_output_offset,
      disconnectedAt: null,
      socket
    };

    this.connections.set(connection.id, connection);
    return connection;
  }

  get(connectionId: ConnectionId): RegisteredConnection | undefined {
    return this.connections.get(connectionId);
  }

  list(): RegisteredConnection[] {
    return [...this.connections.values()];
  }

  remove(connectionId: ConnectionId, now = new Date()): RegisteredConnection | undefined {
    const existing = this.connections.get(connectionId);
    if (existing === undefined) {
      return undefined;
    }

    const disconnected: RegisteredConnection = {
      ...existing,
      state: CONNECTION_STATES.DISCONNECTED,
      disconnectedAt: now.toISOString()
    };
    this.connections.delete(connectionId);
    return disconnected;
  }

  removeBySocket(socket: unknown, now = new Date()): RegisteredConnection | undefined {
    for (const connection of this.connections.values()) {
      if (connection.socket === socket) {
        return this.remove(connection.id, now);
      }
    }

    return undefined;
  }

  touch(
    connectionId: ConnectionId,
    offset?: number,
    now = new Date()
  ): RegisteredConnection | undefined {
    const existing = this.connections.get(connectionId);
    if (existing === undefined) {
      return undefined;
    }

    const updated: RegisteredConnection = {
      ...existing,
      lastSeenAt: now.toISOString(),
      lastOutputOffset: offset ?? existing.lastOutputOffset
    };
    this.connections.set(connectionId, updated);
    return updated;
  }
}

export interface WebSocketServerBootstrap {
  readonly httpServer: HttpServer;
  readonly registry: ConnectionRegistry;
  readonly config: AppConfig;
  readonly webSocketServer: WebSocketServer;
}

export function parseConnectionParams(
  searchParams: URLSearchParams
): Partial<WebSocketConnectionParams> {
  const deviceId = searchParams.get('device_id');
  const accessToken = searchParams.get('access_token') ?? undefined;
  const instanceId = searchParams.get('instance_id');
  const lastOutputOffsetRaw = searchParams.get('last_output_offset');
  const lastOutputOffset = lastOutputOffsetRaw === null ? NaN : Number(lastOutputOffsetRaw);
  const lastInputOffsetRaw = searchParams.get('last_input_offset');
  const lastInputOffset = lastInputOffsetRaw === null ? NaN : Number(lastInputOffsetRaw);

  if (!isNonEmptyString(deviceId)) {
    throw invalidRequest('device_id must be a non-empty string', { field: 'device_id' });
  }

  if (!isNonEmptyString(instanceId)) {
    throw invalidRequest('instance_id must be a non-empty string', { field: 'instance_id' });
  }

  if (!isNonNegativeInteger(lastOutputOffset)) {
    throw invalidRequest('last_output_offset must be a non-negative integer', {
      field: 'last_output_offset'
    });
  }

  if (!isNonNegativeInteger(lastInputOffset)) {
    throw invalidRequest('last_input_offset must be a non-negative integer', {
      field: 'last_input_offset'
    });
  }

  return {
    device_id: deviceId,
    ...(accessToken === undefined ? {} : { access_token: accessToken }),
    instance_id: instanceId,
    last_output_offset: lastOutputOffset,
    last_input_offset: lastInputOffset
  };
}

export function createHelloMessage(
  serverId: string,
  connection: Pick<RegisteredConnection, 'id' | 'instanceId'>,
  nextOutputOffset: number
): HelloMessagePayload {
  return {
    type: SERVER_MESSAGE_TYPES.HELLO,
    server_id: serverId,
    instance_id: connection.instanceId,
    connection_id: connection.id,
    next_output_offset: nextOutputOffset
  };
}

function writeUpgradeRejection(socket: Duplex, statusCode: number, message: string): void {
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
  );
  socket.destroy();
}

function getErrorStatusCode(error: unknown): number {
  if (
    error instanceof Error &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return 500;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'WebSocket upgrade failed';
}

export function installWebSocketUpgradeHandler(input: {
  readonly httpServer: HttpServer;
  readonly webSocketServer: WebSocketServer;
  readonly config: Pick<AppConfig, 'websocketPath' | 'websocketAllowedOrigins'>;
  readonly authentication: WebSocketAuthenticationOptions;
  readonly registry: ConnectionRegistry;
}): void {
  input.httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? '', 'http://localhost');
        rejectInvalidWebSocketRequestPolicy({
          path: url.pathname,
          origin: request.headers.origin ?? null,
          allowedPath: input.config.websocketPath,
          allowedOrigins: input.config.websocketAllowedOrigins
        });
        const params = await authenticateWebSocketConnection(
          parseConnectionParams(url.searchParams),
          input.authentication
        );

        input.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
          input.registry.register(webSocket, params);
          input.webSocketServer.emit('connection', webSocket, request);
        });
      } catch (error) {
        writeUpgradeRejection(socket, getErrorStatusCode(error), getErrorMessage(error));
      }
    })();
  });
}

export function createWebSocketServerBootstrap(
  appConfig: AppConfig = config,
  registry = new ConnectionRegistry(),
  authentication?: WebSocketAuthenticationOptions
): WebSocketServerBootstrap {
  const httpServer = createServer();
  const webSocketServer = new WebSocketServer({ noServer: true });
  if (authentication !== undefined) {
    installWebSocketUpgradeHandler({
      httpServer,
      webSocketServer,
      config: appConfig,
      authentication,
      registry
    });
  }
  return {
    httpServer,
    registry,
    config: appConfig,
    webSocketServer
  };
}
