import type { ClaudeInstanceId, DeviceId, InputMessage, InputMessageId, InputMessageStatus } from "../../../shared/protocol/domain.js";

export interface CreateInputMessageInput {
  readonly id: InputMessageId;
  readonly instanceId: ClaudeInstanceId;
  readonly deviceId: DeviceId;
  readonly payload: string;
  readonly now: Date;
}

export interface InputRepository {
  create(input: CreateInputMessageInput): InputMessage;
  get(instanceId: ClaudeInstanceId, id: InputMessageId): InputMessage | undefined;
  listByInstance(instanceId: ClaudeInstanceId): InputMessage[];
  updateStatus(instanceId: ClaudeInstanceId, id: InputMessageId, status: InputMessageStatus, now: Date): InputMessage | undefined;
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
        deviceId: input.deviceId,
        payload: input.payload,
        status: "queued",
        createdAt: input.now.toISOString(),
        injectedAt: null,
        ackedAt: null,
      };
      listFor(input.instanceId).push(message);
      return message;
    },
    get(instanceId, id) {
      return messagesByInstance.get(instanceId)?.find((message) => message.id === id);
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
        injectedAt: status === "injected" ? now.toISOString() : existing.injectedAt,
        ackedAt: status === "acked" ? now.toISOString() : existing.ackedAt,
      };
      messages[index] = updated;
      return updated;
    },
  };
}
