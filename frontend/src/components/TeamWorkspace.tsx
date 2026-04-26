import type { ReactElement } from "react";

export interface TeamWorkspaceTeammate {
  readonly instanceId: string;
  readonly teammateName: string;
  readonly instanceName: string;
}

export interface TeamWorkspaceState {
  readonly activeInstanceId: string;
  readonly teammates: readonly TeamWorkspaceTeammate[];
}

export function renderTeamWorkspace(state: TeamWorkspaceState): string {
  if (state.teammates.length === 0) {
    return "暂无 teammate 会话。";
  }

  const active = state.teammates.find((teammate) => teammate.instanceId === state.activeInstanceId) ?? state.teammates[0]!;
  const tabs = state.teammates.map((teammate) => `${teammate.teammateName}：${teammate.instanceName}`).join("；");

  return `当前 teammate：${active.teammateName}。可用 teammate：${tabs}`;
}

export interface TeamWorkspaceProps extends TeamWorkspaceState {
  readonly onSelect?: (instanceId: string) => void;
}

export function TeamWorkspace({ activeInstanceId, teammates, onSelect }: TeamWorkspaceProps): ReactElement {
  return (
    <section aria-label="团队工作区">
      <p>{renderTeamWorkspace({ activeInstanceId, teammates })}</p>
      <div role="tablist" aria-label="teammate 会话">
        {teammates.map((teammate) => (
          <button
            aria-selected={teammate.instanceId === activeInstanceId}
            key={teammate.instanceId}
            onClick={() => onSelect?.(teammate.instanceId)}
            role="tab"
            type="button"
          >
            {teammate.teammateName}
          </button>
        ))}
      </div>
      <section aria-label="teammate 面板">
        {teammates.find((teammate) => teammate.instanceId === activeInstanceId)?.instanceName ?? "未选择 teammate"}
      </section>
    </section>
  );
}
