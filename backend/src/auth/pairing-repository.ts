import type { DeviceId, PairingCode, PairingCodeId } from '../../../shared/protocol/domain.js';
import type { SqliteDatabase } from '../db/connection.js';
import { verifyToken } from './tokens.js';

export interface PairingAttemptState {
  readonly key: string;
  readonly failedAttempts: number;
  readonly lockedUntil: string | null;
  readonly lastFailedAt: string | null;
}

export interface RecordFailedPairingAttemptInput {
  readonly key: string;
  readonly failedAt: Date;
  readonly maxFailedAttempts: number;
  readonly cooldownMs: number;
}

export interface PairingRepository {
  create(pairing: PairingCode): PairingCode;
  findByCode(code: string): Promise<PairingCode | undefined>;
  activeBootstrap(now: Date): PairingCode | undefined;
  markUsed(
    pairingId: PairingCodeId,
    usedByDeviceId: DeviceId,
    usedAt: string
  ): PairingCode | undefined;
  claim(
    pairingId: PairingCodeId,
    usedByDeviceId: DeviceId,
    usedAt: string,
    now: Date
  ): PairingCode | undefined;
  getAttemptState(key: string): PairingAttemptState | undefined;
  recordFailedAttempt(input: RecordFailedPairingAttemptInput): PairingAttemptState;
  clearAttemptState(key: string): void;
}

interface PairingRow {
  id: string;
  code_hash: string;
  created_by_device_id: string | null;
  expires_at: string;
  used_at: string | null;
  used_by_device_id: string | null;
}

function mapPairing(row: PairingRow): PairingCode {
  return {
    id: row.id,
    codeHash: row.code_hash,
    createdByDeviceId: row.created_by_device_id,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    usedByDeviceId: row.used_by_device_id
  };
}

interface PairingAttemptRow {
  key: string;
  failed_attempts: number;
  locked_until: string | null;
  last_failed_at: string | null;
}

function mapAttempt(row: PairingAttemptRow): PairingAttemptState {
  return {
    key: row.key,
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until,
    lastFailedAt: row.last_failed_at
  };
}

function calculateFailedAttempt(
  input: RecordFailedPairingAttemptInput,
  current?: PairingAttemptState
): PairingAttemptState {
  const failedAttempts = (current?.failedAttempts ?? 0) + 1;
  const lockedUntil =
    failedAttempts >= input.maxFailedAttempts
      ? new Date(input.failedAt.getTime() + input.cooldownMs).toISOString()
      : null;
  return {
    key: input.key,
    failedAttempts,
    lockedUntil,
    lastFailedAt: input.failedAt.toISOString()
  };
}

export function createSqlitePairingRepository(database: SqliteDatabase): PairingRepository {
  const selectAll = database.prepare('SELECT * FROM pairing_codes ORDER BY expires_at, id');
  const selectById = database.prepare('SELECT * FROM pairing_codes WHERE id = ?');
  const selectAttempt = database.prepare('SELECT * FROM pairing_attempts WHERE key = ?');

  return {
    create(pairing) {
      database
        .prepare(
          `
        INSERT INTO pairing_codes (id, code_hash, created_by_device_id, expires_at, used_at, used_by_device_id)
        VALUES (@id, @codeHash, @createdByDeviceId, @expiresAt, @usedAt, @usedByDeviceId)
      `
        )
        .run(pairing);
      return pairing;
    },
    async findByCode(code) {
      for (const row of selectAll.all() as PairingRow[]) {
        const pairing = mapPairing(row);
        if (await verifyToken(code, pairing.codeHash)) {
          return pairing;
        }
      }
      return undefined;
    },
    activeBootstrap(now) {
      const row = database
        .prepare(
          `
        SELECT * FROM pairing_codes
        WHERE created_by_device_id IS NULL AND used_at IS NULL AND expires_at > ?
        ORDER BY expires_at ASC
        LIMIT 1
      `
        )
        .get(now.toISOString()) as PairingRow | undefined;
      return row === undefined ? undefined : mapPairing(row);
    },
    markUsed(pairingId, usedByDeviceId, usedAt) {
      database
        .prepare('UPDATE pairing_codes SET used_at = ?, used_by_device_id = ? WHERE id = ?')
        .run(usedAt, usedByDeviceId, pairingId);
      const row = selectById.get(pairingId) as PairingRow | undefined;
      return row === undefined ? undefined : mapPairing(row);
    },
    claim(pairingId, usedByDeviceId, usedAt, now) {
      const result = database
        .prepare(
          `
        UPDATE pairing_codes
        SET used_at = ?, used_by_device_id = ?
        WHERE id = ? AND used_at IS NULL AND expires_at > ?
      `
        )
        .run(usedAt, usedByDeviceId, pairingId, now.toISOString());
      if (result.changes !== 1) return undefined;
      const row = selectById.get(pairingId) as PairingRow | undefined;
      return row === undefined ? undefined : mapPairing(row);
    },
    getAttemptState(key) {
      const row = selectAttempt.get(key) as PairingAttemptRow | undefined;
      return row === undefined ? undefined : mapAttempt(row);
    },
    recordFailedAttempt(input) {
      const state = calculateFailedAttempt(input, this.getAttemptState(input.key));
      database
        .prepare(
          `
        INSERT INTO pairing_attempts (key, failed_attempts, locked_until, last_failed_at)
        VALUES (@key, @failedAttempts, @lockedUntil, @lastFailedAt)
        ON CONFLICT(key) DO UPDATE SET
          failed_attempts = excluded.failed_attempts,
          locked_until = excluded.locked_until,
          last_failed_at = excluded.last_failed_at
      `
        )
        .run(state);
      return state;
    },
    clearAttemptState(key) {
      database.prepare('DELETE FROM pairing_attempts WHERE key = ?').run(key);
    }
  };
}

export function createInMemoryPairingRepository(): PairingRepository {
  const pairings = new Map<PairingCodeId, PairingCode>();
  const attempts = new Map<string, PairingAttemptState>();

  return {
    create(pairing) {
      pairings.set(pairing.id, pairing);
      return pairing;
    },
    async findByCode(code) {
      for (const pairing of pairings.values()) {
        if (await verifyToken(code, pairing.codeHash)) {
          return pairing;
        }
      }
      return undefined;
    },
    activeBootstrap(now) {
      for (const pairing of pairings.values()) {
        if (
          pairing.createdByDeviceId === null &&
          pairing.usedAt === null &&
          new Date(pairing.expiresAt).getTime() > now.getTime()
        ) {
          return pairing;
        }
      }
      return undefined;
    },
    markUsed(pairingId, usedByDeviceId, usedAt) {
      const pairing = pairings.get(pairingId);
      if (pairing === undefined) return undefined;
      const updated = { ...pairing, usedAt, usedByDeviceId };
      pairings.set(pairingId, updated);
      return updated;
    },
    claim(pairingId, usedByDeviceId, usedAt, now) {
      const pairing = pairings.get(pairingId);
      if (pairing === undefined) return undefined;
      if (pairing.usedAt !== null) return undefined;
      if (new Date(pairing.expiresAt).getTime() <= now.getTime()) return undefined;
      const updated = { ...pairing, usedAt, usedByDeviceId };
      pairings.set(pairingId, updated);
      return updated;
    },
    getAttemptState(key) {
      return attempts.get(key);
    },
    recordFailedAttempt(input) {
      const state = calculateFailedAttempt(input, attempts.get(input.key));
      attempts.set(input.key, state);
      return state;
    },
    clearAttemptState(key) {
      attempts.delete(key);
    }
  };
}
