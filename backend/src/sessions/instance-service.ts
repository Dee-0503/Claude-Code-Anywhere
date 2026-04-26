import { realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type {
  ClaudeInstance,
  ClaudeInstanceId,
  ClaudeInstanceTeamMetadata,
  DeviceId
} from '../../../shared/protocol/domain.js';
import { PROTOCOL_ERROR_CODES } from '../../../shared/protocol/errors.js';
import { createApiError } from '../api/errors.js';
import type { PtyAdapter, PtyProcess } from '../pty/pty-adapter.js';
import {
  createInMemoryInstanceRepository,
  type InstanceRepository
} from './instance-repository.js';

export interface InstanceServiceOptions {
  readonly repository?: InstanceRepository;
  readonly pty?: PtyAdapter;
  readonly now?: () => Date;
  readonly allowedWorkspaceRoots?: readonly string[];
  readonly maxActiveInstancesPerDevice?: number;
  readonly maxActiveInstancesGlobal?: number;
}

export interface StartedInstance {
  readonly instance: ClaudeInstance;
  readonly process: PtyProcess | null;
}

function serviceError(code: 'INVALID_MESSAGE' | 'RATE_LIMITED', message: string): Error {
  const statusCode = code === PROTOCOL_ERROR_CODES.RATE_LIMITED ? 429 : 400;
  return createApiError(PROTOCOL_ERROR_CODES[code], message, { statusCode });
}

function isWithinRoot(path: string, root: string): boolean {
  const relativePath = relative(root, path);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') &&
      !relativePath.startsWith('/') &&
      !relativePath.startsWith('\\'))
  );
}

function resolveAllowedCwd(cwd: string, allowedRoots: readonly string[]): string {
  const resolvedCwd = resolve(cwd);
  if (allowedRoots.length === 0) {
    return resolvedCwd;
  }

  let realCwd: string;
  try {
    realCwd = realpathSync(resolvedCwd);
  } catch {
    throw serviceError(
      'INVALID_MESSAGE',
      'Instance cwd must exist inside an allowed workspace root'
    );
  }

  let realRoots: string[];
  try {
    realRoots = allowedRoots.map((root) => realpathSync(resolve(root)));
  } catch {
    throw serviceError('INVALID_MESSAGE', 'Instance allowed workspace roots must exist');
  }

  if (!realRoots.some((root) => isWithinRoot(realCwd, root))) {
    throw serviceError('INVALID_MESSAGE', 'Instance cwd is outside allowed workspace roots');
  }
  return realCwd;
}

export function createInstanceService(options: InstanceServiceOptions = {}) {
  const repository = options.repository ?? createInMemoryInstanceRepository();
  const processes = new Map<ClaudeInstanceId, PtyProcess>();
  const now = options.now ?? (() => new Date());
  const allowedWorkspaceRoots = options.allowedWorkspaceRoots ?? [];
  const maxActiveInstancesPerDevice =
    options.maxActiveInstancesPerDevice ?? Number.POSITIVE_INFINITY;
  const maxActiveInstancesGlobal = options.maxActiveInstancesGlobal ?? Number.POSITIVE_INFINITY;

  function activeInstances(): ClaudeInstance[] {
    return repository
      .list()
      .filter((instance) => instance.status !== 'exited' && instance.status !== 'error');
  }

  function assertCapacity(deviceId: DeviceId): void {
    const active = activeInstances();
    if (active.length >= maxActiveInstancesGlobal) {
      throw serviceError('RATE_LIMITED', 'Global active instance limit reached');
    }
    if (
      active.filter((instance) => instance.createdByDeviceId === deviceId).length >=
      maxActiveInstancesPerDevice
    ) {
      throw serviceError('RATE_LIMITED', 'Device active instance limit reached');
    }
  }

  function releaseRuntime(instanceId: ClaudeInstanceId): void {
    processes.delete(instanceId);
  }

  function startInstance(input: {
    cwd: string;
    createdByDeviceId: DeviceId;
    instanceId?: ClaudeInstanceId;
    name?: string;
    teamMetadata?: ClaudeInstanceTeamMetadata | null;
  }): StartedInstance {
    if (input.instanceId !== undefined) {
      const existing = repository.get(input.instanceId);
      if (existing !== undefined) {
        return { instance: existing, process: processes.get(existing.id) ?? null };
      }
    }

    const cwd = resolveAllowedCwd(input.cwd, allowedWorkspaceRoots);
    assertCapacity(input.createdByDeviceId);

    let process: PtyProcess | null = null;
    if (options.pty !== undefined) {
      process = options.pty.spawn({ command: 'claude', cwd, size: { cols: 120, rows: 30 } });
    }

    const instance = repository.create({
      ...(input.name === undefined ? {} : { name: input.name }),
      cwd,
      createdByDeviceId: input.createdByDeviceId,
      ptyPid: process?.pid ?? null,
      teamMetadata: input.teamMetadata ?? null,
      now: now()
    });
    if (process !== null) {
      processes.set(instance.id, process);
      process.onExit(() => {
        releaseRuntime(instance.id);
        const current = repository.get(instance.id);
        if (current !== undefined && current.status !== 'exited' && current.status !== 'error') {
          repository.update({ ...current, status: 'exited', exitedAt: now().toISOString() });
        }
      });
    }

    return { instance, process };
  }

  function getInstance(instanceId: ClaudeInstanceId): ClaudeInstance | undefined {
    return repository.get(instanceId);
  }

  function getInstanceForDevice(
    instanceId: ClaudeInstanceId,
    deviceId: DeviceId
  ): ClaudeInstance | undefined {
    const instance = repository.get(instanceId);
    if (instance === undefined || instance.createdByDeviceId !== deviceId) {
      return undefined;
    }
    return instance;
  }

  function listInstancesForDevice(deviceId: DeviceId): ClaudeInstance[] {
    return repository.list().filter((instance) => instance.createdByDeviceId === deviceId);
  }

  function getProcess(instanceId: ClaudeInstanceId): PtyProcess | undefined {
    return processes.get(instanceId);
  }

  function stopInstance(instanceId: ClaudeInstanceId): ClaudeInstance | undefined {
    const instance = repository.get(instanceId);
    if (instance === undefined) {
      return undefined;
    }
    const updated: ClaudeInstance = {
      ...instance,
      status: 'exited',
      exitedAt: now().toISOString()
    };
    const process = processes.get(instanceId);
    process?.kill();
    releaseRuntime(instanceId);
    return repository.update(updated);
  }

  function stopInstanceForDevice(
    instanceId: ClaudeInstanceId,
    deviceId: DeviceId
  ): ClaudeInstance | undefined {
    const instance = getInstanceForDevice(instanceId, deviceId);
    if (instance === undefined) {
      return undefined;
    }
    return stopInstance(instanceId);
  }

  return {
    startInstance,
    getInstance,
    getInstanceForDevice,
    listInstancesForDevice,
    getProcess,
    stopInstance,
    stopInstanceForDevice,
    repository
  };
}

export type InstanceService = ReturnType<typeof createInstanceService>;
