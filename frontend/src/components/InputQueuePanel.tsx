import type { ReactElement } from "react";

export interface InputQueuePanelItem {
  readonly inputId: string;
  readonly deviceId: string;
  readonly payload: string;
  readonly status: "queued" | "cancelled";
}

export function renderInputQueuePanel(inputs: readonly InputQueuePanelItem[]): string {
  if (inputs.length === 0) {
    return "没有等待发送的输入。";
  }

  const queued = inputs.filter((input) => input.status === "queued");
  const details = inputs.map((input) => {
    if (input.status === "cancelled") {
      return `${input.deviceId}：已取消`;
    }
    return `${input.deviceId}：${input.payload.trim()}`;
  });

  return `${queued.length} 条输入等待发送。${details.join("。")}`;
}

export interface InputQueuePanelProps {
  readonly inputs: readonly InputQueuePanelItem[];
  readonly onCancel?: (inputId: string) => void;
}

export function InputQueuePanel({ inputs, onCancel }: InputQueuePanelProps): ReactElement {
  return (
    <section aria-label="输入队列">
      <p>{renderInputQueuePanel(inputs)}</p>
      <ul>
        {inputs.map((input) => (
          <li key={input.inputId}>
            {input.deviceId}：{input.status === "cancelled" ? "已取消" : input.payload}
            {input.status === "queued" ? (
              <button type="button" onClick={() => onCancel?.(input.inputId)}>取消</button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
