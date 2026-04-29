import type { ClaudeInstanceId, DeviceId } from '../../../shared/protocol/domain.js';

export interface PresenceConnection {
  readonly connectionId: string;
  readonly deviceId: DeviceId;
  readonly instanceId: ClaudeInstanceId;
}

export function createPresenceService() {
  const connections = new Map<string, PresenceConnection>();

  function join(connection: PresenceConnection): void {
    connections.set(connection.connectionId, connection);
  }

  function leave(connectionId: string): void {
    connections.delete(connectionId);
  }

  function list(instanceId: ClaudeInstanceId): PresenceConnection[] {
    return [...connections.values()].filter((connection) => connection.instanceId === instanceId);
  }

  return { join, leave, list };
}

export type PresenceService = ReturnType<typeof createPresenceService>;
