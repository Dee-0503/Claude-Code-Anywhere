import type { ClaudeInstanceId, DeviceId, InputMessage, InputMessageId } from "../../../shared/protocol/domain.js";
import { INPUT_ACK_STATUSES, type InputAckStatus } from "../../../shared/protocol/messages.js";
import { createInMemoryInputRepository, type InputRepository } from "./input-repository.js";

export interface InputQueueOptions {
  readonly repository?: InputRepository;
  readonly now?: () => Date;
}

export interface EnqueueInput {
  readonly id: InputMessageId;
  readonly instanceId: ClaudeInstanceId;
  readonly deviceId: DeviceId;
  readonly payload: string;
}

export interface EnqueueResult {
  readonly status: InputAckStatus;
  readonly message: InputMessage;
}

export function createInputQueue(options: InputQueueOptions = {}) {
  const repository = options.repository ?? createInMemoryInputRepository();
  const now = options.now ?? (() => new Date());

  function classify(payload: string): "text" | "interrupt" {
    return payload === "" ? "interrupt" : "text";
  }

  function enqueue(input: EnqueueInput): EnqueueResult {
    const existing = repository.get(input.instanceId, input.id);
    if (existing !== undefined) {
      return { status: INPUT_ACK_STATUSES.DUPLICATE, message: existing };
    }
    if (classify(input.payload) === "interrupt") {
      const message = repository.create({
        id: input.id,
        instanceId: input.instanceId,
        deviceId: input.deviceId,
        payload: input.payload,
        now: now(),
      });
      return { status: INPUT_ACK_STATUSES.PENDING_CONFIRMATION, message };
    }

    const message = repository.create({
      id: input.id,
      instanceId: input.instanceId,
      deviceId: input.deviceId,
      payload: input.payload,
      now: now(),
    });
    return { status: INPUT_ACK_STATUSES.ACCEPTED, message };
  }

  function drainReady(instanceId: ClaudeInstanceId): InputMessage[] {
    const ready = repository
      .listByInstance(instanceId)
      .filter((message) => message.status === "queued");

    for (const message of ready) {
      repository.updateStatus(instanceId, message.id, "injected", now());
    }

    return ready;
  }

  function listPendingConfirmations(instanceId: ClaudeInstanceId): InputMessage[] {
    return repository
      .listByInstance(instanceId)
      .filter((message) => message.status === "queued");
  }

  function listQueuedInputs(instanceId: ClaudeInstanceId): InputMessage[] {
    return listPendingConfirmations(instanceId);
  }

  function cancel(instanceId: ClaudeInstanceId, inputId: InputMessageId): InputMessage | undefined {
    const message = repository.get(instanceId, inputId);
    if (message?.status !== "queued") {
      return undefined;
    }
    return repository.updateStatus(instanceId, inputId, "cancelled", now());
  }

  function confirmPending(instanceId: ClaudeInstanceId, inputIds: readonly InputMessageId[]): InputMessage[] {
    const confirmed: InputMessage[] = [];
    for (const inputId of inputIds) {
      const message = repository.get(instanceId, inputId);
      if (message?.status === "queued") {
        confirmed.push(message);
      }
    }
    for (const message of confirmed) {
      repository.updateStatus(instanceId, message.id, "injected", now());
    }
    return confirmed;
  }

  return { enqueue, drainReady, listPendingConfirmations, listQueuedInputs, cancel, classify, confirmPending, repository };
}

export type InputQueue = ReturnType<typeof createInputQueue>;
