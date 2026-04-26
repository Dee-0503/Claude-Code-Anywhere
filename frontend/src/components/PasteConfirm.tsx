import type { ReactElement } from "react";

export function renderPasteConfirm(payload: string): string {
  if (payload.length === 0) {
    return "没有待确认的粘贴内容。";
  }

  const lines = payload.split(/\r?\n/).filter((line) => line.length > 0);
  return `${lines.length} 行粘贴内容等待确认。`;
}

export interface PasteConfirmProps {
  readonly payload: string;
  readonly onConfirm?: (payload: string) => void;
  readonly onCancel?: () => void;
}

export function PasteConfirm({ payload, onConfirm, onCancel }: PasteConfirmProps): ReactElement | null {
  if (payload.length === 0) {
    return null;
  }

  return (
    <section aria-label="粘贴确认">
      <p>{renderPasteConfirm(payload)}</p>
      <pre>{payload}</pre>
      <button type="button" onClick={() => onConfirm?.(payload)}>确认发送</button>
      <button type="button" onClick={onCancel}>取消</button>
    </section>
  );
}
