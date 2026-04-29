import { randomUUID } from 'node:crypto';

import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  type ClientMessageType,
  type ClientToServerMessage,
  type HelloMessagePayload,
  type InputAckStatus,
  type WebSocketConnectionParams,
  type ConnectionState
} from '../../../shared/protocol/messages.js';
import { invalidRequest } from './errors.js';
import {
  isIsoDateString,
  requireEnumField,
  requireNonNegativeIntegerField,
  requireRecord,
  requireStringField
} from './validation.js';
import { BoundedOutputBuffer } from '../sessions/output-buffer.js';
import {
  authenticateWebSocketConnection,
  type WebSocketAuthenticationOptions
} from './websocket-auth.js';
import { replayOutput, type ReplayMessage } from '../sessions/replay-service.js';

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

const MAX_INPUT_PAYLOAD_BYTES = 64 * 1024;
const CLIENT_MESSAGE_TYPE_VALUES = Object.values(CLIENT_MESSAGE_TYPES) as ClientMessageType[];

function parseClientMessagePayload(raw: string): Record<string, unknown> {
  try {
    return requireRecord(JSON.parse(raw), 'WebSocket client message must be an object');
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw invalidRequest('WebSocket client message must be valid JSON');
    }
    throw error;
  }
}

function requirePayloadWithinLimit(source: Record<string, unknown>): string {
  const payload = requireStringField(source, 'payload');
  if (Buffer.byteLength(payload, 'utf8') > MAX_INPUT_PAYLOAD_BYTES) {
    throw invalidRequest(`payload must be at most ${MAX_INPUT_PAYLOAD_BYTES} bytes`, {
      field: 'payload',
      maxBytes: MAX_INPUT_PAYLOAD_BYTES
    });
  }
  return payload;
}

function requireIsoTimestamp(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  if (!isIsoDateString(value)) {
    throw invalidRequest(`${field} must be an ISO timestamp`, { field });
  }
  return value;
}

function requireInstanceInputFields(source: Record<string, unknown>) {
  return {
    instance_id: requireStringField(source, 'instance_id'),
    input_id: requireStringField(source, 'input_id')
  };
}

function validateClientMessage(raw: string): ClientToServerMessage {
  const payload = parseClientMessagePayload(raw);
  const type = requireEnumField(payload, 'type', CLIENT_MESSAGE_TYPE_VALUES);

  switch (type) {
    case CLIENT_MESSAGE_TYPES.INPUT:
      return {
        type,
        ...requireInstanceInputFields(payload),
        ...(payload.input_offset === undefined
          ? {}
          : { input_offset: requireNonNegativeIntegerField(payload, 'input_offset') }),
        payload: requirePayloadWithinLimit(payload)
      };
    case CLIENT_MESSAGE_TYPES.ACK_OUTPUT:
      return {
        type,
        instance_id: requireStringField(payload, 'instance_id'),
        offset: requireNonNegativeIntegerField(payload, 'offset')
      };
    case CLIENT_MESSAGE_TYPES.CANCEL_INPUT:
    case CLIENT_MESSAGE_TYPES.CONFIRM_INTERRUPT:
    case CLIENT_MESSAGE_TYPES.CANCEL_INTERRUPT:
      return { type, ...requireInstanceInputFields(payload) };
    case CLIENT_MESSAGE_TYPES.HEARTBEAT:
      return { type, sent_at: requireIsoTimestamp(payload, 'sent_at') };
  }
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

  function serializeHello(input: {
    serverId: string;
    instanceId: string;
    connectionId: string;
    nextOutputOffset: number;
  }): HelloMessagePayload {
    return {
      type: SERVER_MESSAGE_TYPES.HELLO,
      server_id: input.serverId,
      instance_id: input.instanceId,
      connection_id: input.connectionId,
      next_output_offset: input.nextOutputOffset
    };
  }

  return {
    async acceptConnection(
      params: Partial<WebSocketConnectionParams>,
      authentication: WebSocketAuthenticationOptions
    ): Promise<AcceptedConnection> {
      const validParams = await authenticateWebSocketConnection(params, authentication);
      const buffer = getBuffer(validParams.instance_id);
      const hello = serializeHello({
        serverId,
        instanceId: validParams.instance_id,
        connectionId: randomUUID(),
        nextOutputOffset: buffer.snapshot.nextOffset
      });
      return { ...hello, replay: replayOutput(buffer, validParams.last_output_offset) };
    },
    serializeHello,
    serializeOutput(input: { instanceId: string; offset: number; data: string }) {
      return {
        type: SERVER_MESSAGE_TYPES.OUTPUT,
        instance_id: input.instanceId,
        offset: input.offset,
        data: input.data
      };
    },
    serializeOutputGap(input: {
      instanceId: string;
      requestedOffset: number;
      availableFromOffset: number;
    }) {
      return {
        type: SERVER_MESSAGE_TYPES.OUTPUT_GAP,
        instance_id: input.instanceId,
        requested_offset: input.requestedOffset,
        available_from_offset: input.availableFromOffset
      };
    },
    serializeInputAck(input: {
      instanceId: string;
      inputId: string;
      inputOffset: number;
      status: InputAckStatus;
    }) {
      return {
        type: SERVER_MESSAGE_TYPES.INPUT_ACK,
        instance_id: input.instanceId,
        input_id: input.inputId,
        input_offset: input.inputOffset,
        status: input.status
      };
    },
    serializeConnectionState(state: ConnectionState) {
      return {
        type: SERVER_MESSAGE_TYPES.CONNECTION_STATE,
        state
      };
    },
    parseClientMessage(raw: string): ClientToServerMessage {
      return validateClientMessage(raw);
    },
    async appendOutput(instanceId: string, data: string) {
      return getBuffer(instanceId).append(data);
    },
    getBuffer
  };
}
