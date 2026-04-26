import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEVICE_ROLES,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PRIORITIES
} from '../../../shared/protocol/domain.js';
import { createSqliteDeviceRepository } from '../../src/auth/device-repository.js';
import { createSqlitePairingRepository } from '../../src/auth/pairing-repository.js';
import { hashToken } from '../../src/auth/tokens.js';
import { closeDatabaseConnection, openDatabaseConnection } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createSqliteNotificationRepository } from '../../src/notifications/notification-repository.js';
import { createSqliteInputRepository } from '../../src/sessions/input-repository.js';
import { createSqliteInstanceRepository } from '../../src/sessions/instance-repository.js';

const tempDirs: string[] = [];
const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDirectory, '../../..');

function createDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'cca-sqlite-persistence-'));
  tempDirs.push(directory);
  return join(directory, 'state.sqlite');
}

function openMigratedDatabase(path: string) {
  const database = openDatabaseConnection({ path });
  runMigrations(database);
  return database;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('SQLite repository persistence', () => {
  it('persists runtime repositories across database restarts', async () => {
    const databasePath = createDatabasePath();
    const issuedToken = 'device-token';
    const pairingCode = '123-456';

    {
      const database = openMigratedDatabase(databasePath);
      const devices = createSqliteDeviceRepository(database);
      const pairings = createSqlitePairingRepository(database);
      const instances = createSqliteInstanceRepository(database);
      const inputs = createSqliteInputRepository(database);
      const notifications = createSqliteNotificationRepository(database);

      devices.create({
        id: 'device-1',
        name: 'Cee iPhone',
        role: DEVICE_ROLES.ADMIN,
        tokenHash: await hashToken(issuedToken),
        createdAt: '2026-04-26T00:00:00.000Z',
        lastSeenAt: '2026-04-26T00:00:00.000Z',
        revokedAt: null
      });
      pairings.create({
        id: 'pairing-1',
        codeHash: await hashToken(pairingCode),
        createdByDeviceId: 'device-1',
        expiresAt: '2026-04-26T00:10:00.000Z',
        usedAt: null,
        usedByDeviceId: null
      });
      pairings.recordFailedAttempt({
        key: 'pairing-consume',
        failedAt: new Date('2026-04-26T00:00:30.000Z'),
        maxFailedAttempts: 1,
        cooldownMs: 60_000
      });
      const instance = instances.create({
        cwd: '/workspace/project',
        createdByDeviceId: 'device-1',
        name: 'Persisted Claude',
        ptyPid: 1234,
        teamMetadata: {
          teamId: 'team-1',
          teammateId: 'mate-1',
          teammateName: 'Reviewer'
        },
        now: new Date('2026-04-26T00:01:00.000Z')
      });
      const input = inputs.create({
        id: 'input-1',
        instanceId: instance.id,
        deviceId: 'device-1',
        payload: 'npm test\n',
        now: new Date('2026-04-26T00:02:00.000Z')
      });
      inputs.updateStatus(instance.id, input.id, 'injected', new Date('2026-04-26T00:03:00.000Z'));
      inputs.updateStatus(instance.id, input.id, 'acked', new Date('2026-04-26T00:04:00.000Z'));
      const notification = notifications.create({
        id: 'notification-1',
        instanceId: instance.id,
        type: NOTIFICATION_EVENT_TYPES.INPUT_REQUIRED,
        priority: NOTIFICATION_PRIORITIES.HIGH,
        title: 'Approval needed',
        body: 'Claude needs approval',
        now: new Date('2026-04-26T00:05:00.000Z')
      });
      notifications.markDelivered(
        notification.id,
        'device-1',
        new Date('2026-04-26T00:06:00.000Z')
      );
      notifications.markRead(notification.id, new Date('2026-04-26T00:07:00.000Z'));

      closeDatabaseConnection(database);
    }

    {
      const database = openMigratedDatabase(databasePath);
      const devices = createSqliteDeviceRepository(database);
      const pairings = createSqlitePairingRepository(database);
      const instances = createSqliteInstanceRepository(database);
      const inputs = createSqliteInputRepository(database);
      const notifications = createSqliteNotificationRepository(database);

      await expect(devices.verifyToken('device-1', issuedToken)).resolves.toMatchObject({
        id: 'device-1',
        name: 'Cee iPhone',
        role: DEVICE_ROLES.ADMIN,
        revokedAt: null
      });
      expect(devices.hasActiveAdmin()).toBe(true);
      await expect(pairings.findByCode(pairingCode)).resolves.toMatchObject({
        id: 'pairing-1',
        createdByDeviceId: 'device-1',
        usedAt: null
      });
      expect(pairings.getAttemptState('pairing-consume')).toEqual({
        key: 'pairing-consume',
        failedAttempts: 1,
        lockedUntil: '2026-04-26T00:01:30.000Z',
        lastFailedAt: '2026-04-26T00:00:30.000Z'
      });
      expect(instances.list()).toEqual([
        expect.objectContaining({
          name: 'Persisted Claude',
          cwd: '/workspace/project',
          ptyPid: 1234,
          teamMetadata: {
            teamId: 'team-1',
            teammateId: 'mate-1',
            teammateName: 'Reviewer'
          }
        })
      ]);
      const [persistedInstance] = instances.list();
      expect(persistedInstance).toBeDefined();
      expect(inputs.listByInstance(persistedInstance!.id)).toEqual([
        expect.objectContaining({
          id: 'input-1',
          payload: 'npm test\n',
          status: 'acked',
          injectedAt: '2026-04-26T00:03:00.000Z',
          ackedAt: '2026-04-26T00:04:00.000Z'
        })
      ]);
      expect(notifications.get('notification-1')).toMatchObject({
        id: 'notification-1',
        deviceId: 'device-1',
        status: 'read',
        title: 'Approval needed',
        body: 'Claude needs approval',
        deliveredAt: '2026-04-26T00:06:00.000Z',
        readAt: '2026-04-26T00:07:00.000Z'
      });

      closeDatabaseConnection(database);
    }
  });

  it('persists repository state across separate Node processes', () => {
    const databasePath = createDatabasePath();
    const writerPath = join(dirname(databasePath), 'write-state.mjs');
    const readerPath = join(dirname(databasePath), 'read-state.mjs');

    writeFileSync(
      writerPath,
      `
        import { createSqliteDeviceRepository } from "${repoRoot}/backend/dist/backend/src/auth/device-repository.js";
        import { hashToken } from "${repoRoot}/backend/dist/backend/src/auth/tokens.js";
        import { openDatabaseConnection, closeDatabaseConnection } from "${repoRoot}/backend/dist/backend/src/db/connection.js";
        import { runMigrations } from "${repoRoot}/backend/dist/backend/src/db/migrations.js";
        import { readFileSync } from "node:fs";
        import { join } from "node:path";
        const database = openDatabaseConnection({ path: process.argv[2] });
        runMigrations(database, [{ version: 1, name: "initial_schema", sql: readFileSync(join(process.argv[3], "backend/src/db/schema.sql"), "utf8") }]);
        createSqliteDeviceRepository(database).create({
          id: "process-device",
          name: "Process Browser",
          role: "admin",
          tokenHash: await hashToken("process-token"),
          createdAt: "2026-04-26T01:00:00.000Z",
          lastSeenAt: "2026-04-26T01:00:00.000Z",
          revokedAt: null,
        });
        closeDatabaseConnection(database);
      `
    );
    writeFileSync(
      readerPath,
      `
        import { createSqliteDeviceRepository } from "${repoRoot}/backend/dist/backend/src/auth/device-repository.js";
        import { openDatabaseConnection, closeDatabaseConnection } from "${repoRoot}/backend/dist/backend/src/db/connection.js";
        import { runMigrations } from "${repoRoot}/backend/dist/backend/src/db/migrations.js";
        import { readFileSync } from "node:fs";
        import { join } from "node:path";
        const database = openDatabaseConnection({ path: process.argv[2] });
        runMigrations(database, [{ version: 1, name: "initial_schema", sql: readFileSync(join(process.argv[3], "backend/src/db/schema.sql"), "utf8") }]);
        const device = await createSqliteDeviceRepository(database).verifyToken("process-device", "process-token");
        closeDatabaseConnection(database);
        if (device?.name !== "Process Browser") {
          throw new Error("Persisted device was not readable in a separate process");
        }
      `
    );

    execFileSync(process.execPath, [writerPath, databasePath, repoRoot], {
      cwd: repoRoot,
      stdio: 'pipe'
    });
    execFileSync(process.execPath, [readerPath, databasePath, repoRoot], {
      cwd: repoRoot,
      stdio: 'pipe'
    });
  });
});
