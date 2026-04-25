import type { ReactElement } from "react";

export interface InstanceSwitcherItem {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

export interface InstanceSwitcherState {
  readonly currentInstanceId: string | null;
  readonly instances: readonly InstanceSwitcherItem[];
}

export function renderInstanceSwitcher(state: InstanceSwitcherState): string {
  if (state.instances.length === 0) {
    return "暂无 Claude Code 实例。";
  }

  const current = state.instances.find((instance) => instance.id === state.currentInstanceId);
  const switchTargets = state.instances.filter((instance) => instance.id !== state.currentInstanceId);
  const targetSummary = switchTargets.length === 0
    ? "无其他可切换实例。"
    : `可切换实例：${switchTargets.map((instance) => `${instance.name}（${instance.status}）`).join("、")}`;

  return `当前实例：${current?.name ?? "未选择"}。${targetSummary}`;
}

export interface InstanceSwitcherProps extends InstanceSwitcherState {
  readonly onSwitch?: (instanceId: string) => void;
}

export function InstanceSwitcher({ currentInstanceId, instances, onSwitch }: InstanceSwitcherProps): ReactElement {
  return (
    <section aria-label="实例切换">
      <p>{renderInstanceSwitcher({ currentInstanceId, instances })}</p>
      <ul>
        {instances.map((instance) => (
          <li key={instance.id}>
            <button type="button" disabled={instance.id === currentInstanceId} onClick={() => onSwitch?.(instance.id)}>
              {instance.name}（{instance.status}）
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
