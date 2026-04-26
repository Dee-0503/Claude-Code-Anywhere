import { randomUUID } from "node:crypto";

import { SERVER_MESSAGE_TYPES, type ClientToServerMessage, type HelloMessagePayload, type InputAckStatus, type WebSocketConnectionParams, type ConnectionState } from "../../../shared/protocol/messages.js";
import { BoundedOutputBuffer } from "../sessions/output-buffer.js";
import { authenticateWebSocketConnection, type WebSocketAuthenticationOptions } from "./websocket-auth.js";
import { replayOutput, type ReplayMessage } from "../sessions/replay-service.js";

export interface WebSocketProtocolServiceOptions {
  readonly outputBufferBytes?: number;
  readonly serverId?: string;
}

export interface AuthenticatedWebSocketProtocolServiceOptions extends WebSocketProtocolServiceOptions {
  readonly authentication: WebSocketAuthenticationOptions;
}

export interface AcceptedConnection extends HelloMessagePayload {
  readonly replay: ReplayMessage[];
}

export function createWebSocketProtocolService(options: WebSocketProtocolServiceOptions = {}) {
  const serverId = options.serverId ?? `server-${randomUUID()}`;
  const capacity = options.outputBufferBytes ?? 1024 * 1024;
  const buffers = new Map<string, BoundedOutputBuffer>();

  function getBuffer(instanceId: string): BoundedOutputBuffer {
    let buffer = buffers.get(instanceId);
    if (buffer === undefined) {
      buffer = new BoundedOutputBuffer(instanceId, capacity);
      buffers.set(instanceId, buffer);
    }
    return buffer;
  }

  function serializeHello(input: { serverId: string; instanceId: string; connectionId: string; nextOutputOffset: number }): HelloMessagePayload {
    return {
      type: SERVER_MESSAGE_TYPES.HELLO,
      server_id: input.serverId,
      instance_id: input.instanceId,
      connection_id: input.connectionId,
      next_output_offset: input.nextOutputOffset,
    };
  }

  return {
    async acceptConnection(params: Partial<WebSocketConnectionParams>, authentication: WebSocketAuthenticationOptions): Promise<AcceptedConnection> {
      const validParams = await authenticateWebSocketConnection(params, authentication);
      const buffer = getBuffer(validParams.instance_id);
      const hello = serializeHello({
        serverId,
        instanceId: validParams.instance_id,
        connectionId: randomUUID(),
        nextOutputOffset: buffer.snapshot.nextOffset,
      });
      return { ...hello, replay: replayOutput(buffer, validParams.last_output_offset) };
    },
    serializeHello,
    serializeOutput(input: { instanceId: string; offset: number; data: string }) {
      return {
        type: SERVER_MESSAGE_TYPES.OUTPUT,
        instance_id: input.instanceId,
        offset: input.offset,
        data: input.data,
      };
    },
    serializeOutputGap(input: { instanceId: string; requestedOffset: number; availableFromOffset: number }) {
      return {
        type: SERVER_MESSAGE_TYPES.OUTPUT_GAP,
        instance_id: input.instanceId,
        requested_offset: input.requestedOffset,
        available_from_offset: input.availableFromOffset,
      };
    },
    serializeInputAck(input: { instanceId: string; inputId: string; status: InputAckStatus }) {
      return {
        type: SERVER_MESSAGE_TYPES.INPUT_ACK,
        instance_id: input.instanceId,
        input_id: input.inputId,
        status: input.status,
      };
    },
    serializeConnectionState(state: ConnectionState) {
      return {
        type: SERVER_MESSAGE_TYPES.CONNECTION_STATE,
        state,
      };
    },
    parseClientMessage(raw: string): ClientToServerMessage {
      return JSON.parse(raw) as ClientToServerMessage;
    },
    async appendOutput(instanceId: string, data: string) {
      return getBuffer(instanceId).append(data);
    },
    getBuffer,
  };
}
