import type { Device, DeviceId } from '../../../shared/protocol/domain.js';
import type { SqliteDatabase } from '../db/connection.js';
import { verifyToken } from './tokens.js';

export interface DeviceRepository {
  create(device: Device): Device;
  list(): Device[];
  getById(deviceId: DeviceId): Device | undefined;
  hasActiveAdmin(): boolean;
  updateLastSeen(deviceId: DeviceId, lastSeenAt: string): Device | undefined;
  updateRole(deviceId: DeviceId, role: Device['role']): Device | undefined;
  revoke(deviceId: DeviceId, revokedAt: string): Device | undefined;
  delete(deviceId: DeviceId): boolean;
  verifyToken(deviceId: DeviceId, accessToken: string): Promise<Device | undefined>;
}

interface DeviceRow {
  id: string;
  name: string;
  role: Device['role'];
  token_hash: string;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at
  };
}

export function createSqliteDeviceRepository(database: SqliteDatabase): DeviceRepository {
  const insert = database.prepare(`
    INSERT INTO devices (id, name, role, token_hash, created_at, last_seen_at, revoked_at)
    VALUES (@id, @name, @role, @tokenHash, @createdAt, @lastSeenAt, @revokedAt)
  `);
  const selectById = database.prepare('SELECT * FROM devices WHERE id = ?');
  const selectAll = database.prepare('SELECT * FROM devices ORDER BY created_at, id');

  return {
    create(device) {
      insert.run(device);
      return device;
    },
    list() {
      return (selectAll.all() as DeviceRow[]).map(mapDevice);
    },
    getById(deviceId) {
      const row = selectById.get(deviceId) as DeviceRow | undefined;
      return row === undefined ? undefined : mapDevice(row);
    },
    hasActiveAdmin() {
      const row = database
        .prepare(
          "SELECT 1 AS active FROM devices WHERE role = 'admin' AND revoked_at IS NULL LIMIT 1"
        )
        .get() as { active: number } | undefined;
      return row !== undefined;
    },
    updateLastSeen(deviceId, lastSeenAt) {
      database
        .prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?')
        .run(lastSeenAt, deviceId);
      return this.getById(deviceId);
    },
    updateRole(deviceId, role) {
      database.prepare('UPDATE devices SET role = ? WHERE id = ?').run(role, deviceId);
      return this.getById(deviceId);
    },
    revoke(deviceId, revokedAt) {
      database.prepare('UPDATE devices SET revoked_at = ? WHERE id = ?').run(revokedAt, deviceId);
      return this.getById(deviceId);
    },
    delete(deviceId) {
      const result = database.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
      return result.changes === 1;
    },
    async verifyToken(deviceId, accessToken) {
      const device = this.getById(deviceId);
      if (device === undefined || device.revokedAt !== null) return undefined;
      return (await verifyToken(accessToken, device.tokenHash)) ? device : undefined;
    }
  };
}
export function createInMemoryDeviceRepository(): DeviceRepository {
  const devices = new Map<DeviceId, Device>();

  return {
    create(device) {
      devices.set(device.id, device);
      return device;
    },
    list() {
      return [...devices.values()];
    },
    getById(deviceId) {
      return devices.get(deviceId);
    },
    hasActiveAdmin() {
      for (const device of devices.values()) {
        if (device.role === 'admin' && device.revokedAt === null) {
          return true;
        }
      }
      return false;
    },
    updateLastSeen(deviceId, lastSeenAt) {
      const device = devices.get(deviceId);
      if (device === undefined) return undefined;
      const updated = { ...device, lastSeenAt };
      devices.set(deviceId, updated);
      return updated;
    },
    updateRole(deviceId, role) {
      const device = devices.get(deviceId);
      if (device === undefined) return undefined;
      const updated = { ...device, role };
      devices.set(deviceId, updated);
      return updated;
    },
    revoke(deviceId, revokedAt) {
      const device = devices.get(deviceId);
      if (device === undefined) return undefined;
      const updated = { ...device, revokedAt };
      devices.set(deviceId, updated);
      return updated;
    },
    delete(deviceId) {
      return devices.delete(deviceId);
    },
    async verifyToken(deviceId, accessToken) {
      const device = devices.get(deviceId);
      if (device === undefined || device.revokedAt !== null) return undefined;
      return (await verifyToken(accessToken, device.tokenHash)) ? device : undefined;
    }
  };
}
