import type { ClaudeInstanceId } from '../../../shared/protocol/domain.js';

export interface TeamDetectionInput {
  readonly instanceId: ClaudeInstanceId;
  readonly instanceName: string;
  readonly teamId?: string;
  readonly teammateId?: string;
  readonly teammateName?: string;
}

export interface TeamSessionTeammate {
  readonly instanceId: ClaudeInstanceId;
  readonly instanceName: string;
  readonly teammateId: string;
  readonly teammateName: string;
}

export interface TeamSessionGroup {
  readonly teamId: string;
  readonly teammates: TeamSessionTeammate[];
}

export function detectTeamSessions(inputs: readonly TeamDetectionInput[]): TeamSessionGroup[] {
  const groups = new Map<string, TeamSessionTeammate[]>();

  for (const input of inputs) {
    const teamId = input.teamId ?? input.instanceId;
    const teammate: TeamSessionTeammate = {
      instanceId: input.instanceId,
      instanceName: input.instanceName,
      teammateId: input.teammateId ?? input.instanceId,
      teammateName: input.teammateName ?? input.instanceName
    };
    groups.set(teamId, [...(groups.get(teamId) ?? []), teammate]);
  }

  return [...groups.entries()].map(([teamId, teammates]) => ({ teamId, teammates }));
}
