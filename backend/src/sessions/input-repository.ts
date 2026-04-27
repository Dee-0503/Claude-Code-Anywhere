import type {
  ClaudeInstanceId,
  DeviceId,
  InputMessage,
  InputMessageId,
  InputMessageStatus
} from '../../../shared/protocol/domain.js';
import type { SqliteDatabase } from '../db/connection.js';

export interface CreateInputMessageInput {
  readonly id: InputMessageId;
  readonly instanceId: ClaudeInstanceId;
  readonly inputOffset?: number;
  readonly deviceId: DeviceId;
  readonly payload: string;
  readonly now: Date;
}

export interface InputRepository {
  create(input: CreateInputMessageInput): InputMessage;
  createFailed(input: CreateInputMessageInput): InputMessage;
  get(instanceId: ClaudeInstanceId, id: InputMessageId): InputMessage | undefined;
  getByOffset(instanceId: ClaudeInstanceId, inputOffset: number): InputMessage | undefined;
  listByInstance(instanceId: ClaudeInstanceId): InputMessage[];
  updateStatus(
    instanceId: ClaudeInstanceId,
    id: InputMessageId,
    status: InputMessageStatus,
    now: Date
  ): InputMessage | undefined;
}

interface InputMessageRow {
  id: string;
  instance_id: string;
  input_offset: number;
  device_id: string;
  payload: string;
  status: InputMessageStatus;
  created_at: string;
  injected_at: string | null;
  acked_at: string | null;
}

function mapInputMessage(row: InputMessageRow): InputMessage {
  return {
    id: row.id,
    instanceId: row.instance_id,
    inputOffset: row.input_offset,
    deviceId: row.device_id,
    payload: row.payload,
    status: row.status,
    createdAt: row.created_at,
    injectedAt: row.injected_at,
    ackedAt: row.acked_at
  };
}

function resolveInputOffset(input: CreateInputMessageInput): number {
  return input.inputOffset ?? 0;
}

export function createSqliteInputRepository(database: SqliteDatabase): InputRepository {
  const selectByInstanceAndId = database.prepare(
    'SELECT * FROM input_messages WHERE instance_id = ? AND id = ?'
  );
  const selectByInstance = database.prepare(
    'SELECT * FROM input_messages WHERE instance_id = ? ORDER BY created_at, id'
  );
  const selectByInstanceAndOffset = database.prepare(
    'SELECT * FROM input_messages WHERE instance_id = ? AND input_offset = ?'
  );

  return {
    create(input) {
      const message: InputMessage = {
        id: input.id,
        instanceId: input.instanceId,
        inputOffset: resolveInputOffset(input),
        deviceId: input.deviceId,
        payload: input.payload,
        status: 'queued',
        createdAt: input.now.toISOString(),
        injectedAt: null,
        ackedAt: null
      };
      database
        .prepare(
          `
        INSERT INTO input_messages (id, instance_id, input_offset, device_id, payload, status, created_at, injected_at, acked_at)
        VALUES (@id, @instanceId, @inputOffset, @deviceId, @payload, @status, @createdAt, @injectedAt, @ackedAt)
      `
        )
        .run(message);
      return message;
    },
    createFailed(input) {
      const message: InputMessage = {
        id: input.id,
        instanceId: input.instanceId,
        inputOffset: resolveInputOffset(input),
        deviceId: input.deviceId,
        payload: input.payload,
        status: 'failed',
        createdAt: input.now.toISOString(),
        injectedAt: null,
        ackedAt: null
      };
      database
        .prepare(
          `
        INSERT INTO input_messages (id, instance_id, input_offset, device_id, payload, status, created_at, injected_at, acked_at)
        VALUES (@id, @instanceId, @inputOffset, @deviceId, @payload, @status, @createdAt, @injectedAt, @ackedAt)
      `
        )
        .run(message);
      return message;
    },
    get(instanceId, id) {
      const row = selectByInstanceAndId.get(instanceId, id) as InputMessageRow | undefined;
      return row === undefined ? undefined : mapInputMessage(row);
    },
    getByOffset(instanceId, inputOffset) {
      const row = selectByInstanceAndOffset.get(instanceId, inputOffset) as
        | InputMessageRow
        | undefined;
      return row === undefined ? undefined : mapInputMessage(row);
    },
    listByInstance(instanceId) {
      return (selectByInstance.all(instanceId) as InputMessageRow[]).map(mapInputMessage);
    },
    updateStatus(instanceId, id, status, now) {
      const existing = this.get(instanceId, id);
      if (existing === undefined) return undefined;
      const updated: InputMessage = {
        ...existing,
        status,
        injectedAt: status === 'injected' ? now.toISOString() : existing.injectedAt,
        ackedAt: status === 'acked' ? now.toISOString() : existing.ackedAt
      };
      database
        .prepare(
          `
        UPDATE input_messages
        SET status = @status, injected_at = @injectedAt, acked_at = @ackedAt
        WHERE instance_id = @instanceId AND id = @id
      `
        )
        .run(updated);
      return updated;
    }
  };
}

export function createInMemoryInputRepository(): InputRepository {
  const messagesByInstance = new Map<ClaudeInstanceId, InputMessage[]>();

  function listFor(instanceId: ClaudeInstanceId): InputMessage[] {
    let messages = messagesByInstance.get(instanceId);
    if (messages === undefined) {
      messages = [];
      messagesByInstance.set(instanceId, messages);
    }
    return messages;
  }

  return {
    create(input) {
      const message: InputMessage = {
        id: input.id,
        instanceId: input.instanceId,
        inputOffset: resolveInputOffset(input),
        deviceId: input.deviceId,
        payload: input.payload,
        status: 'queued',
        createdAt: input.now.toISOString(),
        injectedAt: null,
        ackedAt: null
      };
      listFor(input.instanceId).push(message);
      return message;
    },
    createFailed(input) {
      const message: InputMessage = {
        id: input.id,
        instanceId: input.instanceId,
        inputOffset: resolveInputOffset(input),
        deviceId: input.deviceId,
        payload: input.payload,
        status: 'failed',
        createdAt: input.now.toISOString(),
        injectedAt: null,
        ackedAt: null
      };
      listFor(input.instanceId).push(message);
      return message;
    },
    get(instanceId, id) {
      return messagesByInstance.get(instanceId)?.find((message) => message.id === id);
    },
    getByOffset(instanceId, inputOffset) {
      return messagesByInstance
        .get(instanceId)
        ?.find((message) => message.inputOffset === inputOffset);
    },
    listByInstance(instanceId) {
      return [...listFor(instanceId)];
    },
    updateStatus(instanceId, id, status, now) {
      const messages = listFor(instanceId);
      const index = messages.findIndex((message) => message.id === id);
      const existing = messages[index];
      if (existing === undefined) {
        return undefined;
      }
      const updated: InputMessage = {
        ...existing,
        status,
        injectedAt: status === 'injected' ? now.toISOString() : existing.injectedAt,
        ackedAt: status === 'acked' ? now.toISOString() : existing.ackedAt
      };
      messages[index] = updated;
      return updated;
    }
  };
}
