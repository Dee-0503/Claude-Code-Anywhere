import type { InputMessageId } from "../../../shared/protocol/domain.js";
import { INPUT_ACK_STATUSES, SERVER_MESSAGE_TYPES, type InputAckMessagePayload, type ServerToClientMessage } from "../../../shared/protocol/messages.js";

export interface PendingInput {
  readonly inputId: InputMessageId;
  readonly payload: string;
  readonly sent: boolean;
  readonly awaitingConfirmation: boolean;
}

export interface InputTransport {
  sendInput(input: { instanceId: string; inputId: InputMessageId; payload: string }): void;
}

export interface InputRecoveryClientOptions {
  readonly deviceId: string;
  readonly instanceId: string;
  readonly transport: InputTransport;
  readonly retryAfterMs?: number;
  readonly createInputId?: () => InputMessageId;
}

export function createInputRecoveryClient(options: InputRecoveryClientOptions) {
  const retryAfterMs = options.retryAfterMs ?? 3_000;
  const createInputId = options.createInputId ?? (() => `${options.deviceId}:${Date.now()}:${Math.random().toString(36).slice(2)}`);
  const pendingInputs = new Map<InputMessageId, PendingInput>();
  let online = true;

  function transmit(input: PendingInput): void {
    options.transport.sendInput({
      instanceId: options.instanceId,
      inputId: input.inputId,
      payload: input.payload,
    });
    pendingInputs.set(input.inputId, { ...input, sent: true });
    window.setTimeout(() => {
      if (pendingInputs.has(input.inputId) && online && !pendingInputs.get(input.inputId)!.awaitingConfirmation) {
        transmit(pendingInputs.get(input.inputId)!);
      }
    }, retryAfterMs);
  }

  function send(payload: string): InputMessageId {
    const input: PendingInput = {
      inputId: createInputId(),
      payload,
      sent: false,
      awaitingConfirmation: false,
    };
    pendingInputs.set(input.inputId, input);
    if (online) {
      transmit(input);
    }
    return input.inputId;
  }

  function handleMessage(message: ServerToClientMessage): void {
    if (message.type !== SERVER_MESSAGE_TYPES.INPUT_ACK) {
      return;
    }
    handleAck(message);
  }

  function handleAck(message: InputAckMessagePayload): void {
    if (message.status === INPUT_ACK_STATUSES.PENDING_CONFIRMATION) {
      const input = pendingInputs.get(message.input_id);
      if (input !== undefined) {
        pendingInputs.set(message.input_id, { ...input, awaitingConfirmation: true });
      }
      return;
    }
    pendingInputs.delete(message.input_id);
  }

  function pending(): PendingInput[] {
    return [...pendingInputs.values()];
  }

  function setOnline(nextOnline: boolean): void {
    online = nextOnline;
  }

  function confirmReplay(): void {
    online = true;
    for (const input of pendingInputs.values()) {
      if (!input.sent) {
        transmit(input);
      }
    }
  }

  return { send, handleMessage, handleAck, pending, setOnline, confirmReplay };
}

export type InputRecoveryClient = ReturnType<typeof createInputRecoveryClient>;
