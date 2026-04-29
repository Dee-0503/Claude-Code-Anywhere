import type { ClaudeInstanceId, InputMessage } from '../../../shared/protocol/domain.js';
import type { PtyProcess } from '../pty/pty-adapter.js';
import type { InputQueue } from './input-queue.js';

export interface InputInjectionResult {
  readonly injected: readonly InputMessage[];
}

export function injectReadyInput(input: {
  readonly instanceId: ClaudeInstanceId;
  readonly queue: InputQueue;
  readonly process: Pick<PtyProcess, 'write'>;
}): InputInjectionResult {
  const ready = input.queue.drainReady(input.instanceId);
  for (const message of ready) {
    input.process.write(message.payload);
  }

  return { injected: ready };
}
