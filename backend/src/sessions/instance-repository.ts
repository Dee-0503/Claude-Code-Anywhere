import { randomUUID } from "node:crypto";

import {
  CLAUDE_INSTANCE_STATUSES,
  type ClaudeInstance,
  type ClaudeInstanceId,
  type DeviceId,
} from "../../../shared/protocol/domain.js";

export interface InstanceRepository {
  create(input: { cwd: string; createdByDeviceId: DeviceId; name?: string; ptyPid?: number | null; now?: Date }): ClaudeInstance;
  get(instanceId: ClaudeInstanceId): ClaudeInstance | undefined;
  update(instance: ClaudeInstance): ClaudeInstance;
  list(): ClaudeInstance[];
}

export function createInMemoryInstanceRepository(): InstanceRepository {
  const instances = new Map<ClaudeInstanceId, ClaudeInstance>();

  return {
    create(input) {
      const timestamp = (input.now ?? new Date()).toISOString();
      const instance: ClaudeInstance = {
        id: randomUUID(),
        name: input.name ?? "Claude Code",
        status: CLAUDE_INSTANCE_STATUSES.RUNNING,
        ptyPid: input.ptyPid ?? null,
        cwd: input.cwd,
        createdByDeviceId: input.createdByDeviceId,
        createdAt: timestamp,
        lastActiveAt: timestamp,
        exitedAt: null,
      };
      instances.set(instance.id, instance);
      return instance;
    },
    get(instanceId) {
      return instances.get(instanceId);
    },
    update(instance) {
      instances.set(instance.id, instance);
      return instance;
    },
    list() {
      return [...instances.values()];
    },
  };
}
