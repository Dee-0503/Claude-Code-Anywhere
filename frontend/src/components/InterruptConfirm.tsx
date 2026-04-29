import type { ReactElement } from 'react';

export interface InterruptConfirmState {
  readonly inputId: string | null;
  readonly deviceId: string | null;
  readonly pending: boolean;
}

export function renderInterruptConfirm(state: InterruptConfirmState): string {
  if (!state.pending || state.inputId === null || state.deviceId === null) {
    return '没有待确认的中断请求。';
  }

  return `${state.deviceId} 请求发送 Ctrl+C，中断当前 Claude Code 会话前需要确认。`;
}

export interface InterruptConfirmProps extends InterruptConfirmState {
  readonly onConfirm?: (inputId: string) => void;
  readonly onCancel?: (inputId: string) => void;
}

export function InterruptConfirm({
  inputId,
  deviceId,
  pending,
  onConfirm,
  onCancel
}: InterruptConfirmProps): ReactElement | null {
  if (!pending || inputId === null || deviceId === null) {
    return null;
  }

  return (
    <section aria-label="中断确认">
      <p>{renderInterruptConfirm({ inputId, deviceId, pending })}</p>
      <button type="button" onClick={() => onConfirm?.(inputId)}>
        确认 Ctrl+C
      </button>
      <button type="button" onClick={() => onCancel?.(inputId)}>
        取消
      </button>
    </section>
  );
}
