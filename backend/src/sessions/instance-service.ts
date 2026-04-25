import type { ClaudeInstance, ClaudeInstanceId, DeviceId } from "../../../shared/protocol/domain.js";
import type { PtyAdapter, PtyProcess } from "../pty/pty-adapter.js";
import { createInMemoryInstanceRepository, type InstanceRepository } from "./instance-repository.js";

export interface InstanceServiceOptions {
  readonly repository?: InstanceRepository;
  readonly pty?: PtyAdapter;
  readonly now?: () => Date;
}

export interface StartedInstance {
  readonly instance: ClaudeInstance;
  readonly process: PtyProcess | null;
}

export function createInstanceService(options: InstanceServiceOptions = {}) {
  const repository = options.repository ?? createInMemoryInstanceRepository();
  const processes = new Map<ClaudeInstanceId, PtyProcess>();
  const now = options.now ?? (() => new Date());

  function startInstance(input: { cwd: string; createdByDeviceId: DeviceId; instanceId?: ClaudeInstanceId }): StartedInstance {
    if (input.instanceId !== undefined) {
      const existing = repository.get(input.instanceId);
      if (existing !== undefined) {
        return { instance: existing, process: processes.get(existing.id) ?? null };
      }
    }

    let process: PtyProcess | null = null;
    if (options.pty !== undefined) {
      process = options.pty.spawn({ command: "claude", cwd: input.cwd, size: { cols: 120, rows: 30 } });
    }

    const instance = repository.create({
      cwd: input.cwd,
      createdByDeviceId: input.createdByDeviceId,
      ptyPid: process?.pid ?? null,
      now: now(),
    });
    if (process !== null) {
      processes.set(instance.id, process);
    }

    return { instance, process };
  }

  function getInstance(instanceId: ClaudeInstanceId): ClaudeInstance | undefined {
    return repository.get(instanceId);
  }

  function getProcess(instanceId: ClaudeInstanceId): PtyProcess | undefined {
    return processes.get(instanceId);
  }

  return { startInstance, getInstance, getProcess, repository };
}

export type InstanceService = ReturnType<typeof createInstanceService>;
