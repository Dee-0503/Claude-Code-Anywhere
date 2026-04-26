import type { ReactElement } from 'react';

import type { PendingInput } from '../protocol/input-client.js';

export function renderOfflineInputConfirm(
  pendingInputs: readonly Pick<PendingInput, 'inputId' | 'payload'>[]
): string {
  if (pendingInputs.length === 0) {
    return '没有离线输入等待确认。';
  }
  return `${pendingInputs.length} 条离线输入等待确认，确认后将按原顺序重放。`;
}

export interface OfflineInputConfirmProps {
  readonly pendingInputs: readonly PendingInput[];
  readonly onConfirm: () => void;
}

export function OfflineInputConfirm({
  pendingInputs,
  onConfirm
}: OfflineInputConfirmProps): ReactElement | null {
  if (pendingInputs.length === 0) {
    return null;
  }

  return (
    <section aria-label="离线输入确认">
      <p>{renderOfflineInputConfirm(pendingInputs)}</p>
      <ul>
        {pendingInputs.map((input) => (
          <li key={input.inputId}>
            <code>{input.payload}</code>
          </li>
        ))}
      </ul>
      <button onClick={onConfirm} type="button">
        确认重放离线输入
      </button>
    </section>
  );
}
