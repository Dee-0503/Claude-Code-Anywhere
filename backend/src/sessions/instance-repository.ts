import { randomUUID } from 'node:crypto';

import {
  CLAUDE_INSTANCE_STATUSES,
  type ClaudeInstance,
  type ClaudeInstanceId,
  type ClaudeInstanceTeamMetadata,
  type DeviceId
} from '../../../shared/protocol/domain.js';
import type { SqliteDatabase } from '../db/connection.js';

export interface InstanceRepository {
  create(input: {
    cwd: string;
    createdByDeviceId: DeviceId;
    name?: string;
    ptyPid?: number | null;
    teamMetadata?: ClaudeInstanceTeamMetadata | null;
    now?: Date;
  }): ClaudeInstance;
  get(instanceId: ClaudeInstanceId): ClaudeInstance | undefined;
  update(instance: ClaudeInstance): ClaudeInstance;
  list(): ClaudeInstance[];
}

interface InstanceRow {
  id: string;
  name: string;
  status: ClaudeInstance['status'];
  pty_pid: number | null;
  cwd: string;
  created_by_device_id: string;
  team_metadata_json: string | null;
  created_at: string;
  last_active_at: string | null;
  exited_at: string | null;
}

function mapTeamMetadata(json: string | null): ClaudeInstanceTeamMetadata | null {
  return json === null ? null : (JSON.parse(json) as ClaudeInstanceTeamMetadata);
}

function mapInstance(row: InstanceRow): ClaudeInstance {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    ptyPid: row.pty_pid,
    cwd: row.cwd,
    createdByDeviceId: row.created_by_device_id,
    teamMetadata: mapTeamMetadata(row.team_metadata_json),
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    exitedAt: row.exited_at
  };
}

export function createSqliteInstanceRepository(database: SqliteDatabase): InstanceRepository {
  const selectById = database.prepare('SELECT * FROM instances WHERE id = ?');
  const selectAll = database.prepare('SELECT * FROM instances ORDER BY created_at, id');

  return {
    create(input) {
      const timestamp = (input.now ?? new Date()).toISOString();
      const instance: ClaudeInstance = {
        id: randomUUID(),
        name: input.name ?? 'Claude Code',
        status: CLAUDE_INSTANCE_STATUSES.RUNNING,
        ptyPid: input.ptyPid ?? null,
        cwd: input.cwd,
        createdByDeviceId: input.createdByDeviceId,
        teamMetadata: input.teamMetadata ?? null,
        createdAt: timestamp,
        lastActiveAt: timestamp,
        exitedAt: null
      };
      database
        .prepare(
          `
        INSERT INTO instances (id, name, status, pty_pid, cwd, created_by_device_id, team_metadata_json, created_at, last_active_at, exited_at)
        VALUES (@id, @name, @status, @ptyPid, @cwd, @createdByDeviceId, @teamMetadataJson, @createdAt, @lastActiveAt, @exitedAt)
      `
        )
        .run({
          ...instance,
          teamMetadataJson:
            instance.teamMetadata === null ? null : JSON.stringify(instance.teamMetadata)
        });
      return instance;
    },
    get(instanceId) {
      const row = selectById.get(instanceId) as InstanceRow | undefined;
      return row === undefined ? undefined : mapInstance(row);
    },
    update(instance) {
      database
        .prepare(
          `
        UPDATE instances
        SET name = @name,
            status = @status,
            pty_pid = @ptyPid,
            cwd = @cwd,
            created_by_device_id = @createdByDeviceId,
            team_metadata_json = @teamMetadataJson,
            created_at = @createdAt,
            last_active_at = @lastActiveAt,
            exited_at = @exitedAt
        WHERE id = @id
      `
        )
        .run({
          ...instance,
          teamMetadataJson:
            instance.teamMetadata === null ? null : JSON.stringify(instance.teamMetadata)
        });
      return instance;
    },
    list() {
      return (selectAll.all() as InstanceRow[]).map(mapInstance);
    }
  };
}

export function createInMemoryInstanceRepository(): InstanceRepository {
  const instances = new Map<ClaudeInstanceId, ClaudeInstance>();

  return {
    create(input) {
      const timestamp = (input.now ?? new Date()).toISOString();
      const instance: ClaudeInstance = {
        id: randomUUID(),
        name: input.name ?? 'Claude Code',
        status: CLAUDE_INSTANCE_STATUSES.RUNNING,
        ptyPid: input.ptyPid ?? null,
        cwd: input.cwd,
        createdByDeviceId: input.createdByDeviceId,
        teamMetadata: input.teamMetadata ?? null,
        createdAt: timestamp,
        lastActiveAt: timestamp,
        exitedAt: null
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
    }
  };
}
