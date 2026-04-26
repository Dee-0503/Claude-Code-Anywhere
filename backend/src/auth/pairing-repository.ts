import type { DeviceId, PairingCode, PairingCodeId } from "../../../shared/protocol/domain.js";
import type { SqliteDatabase } from "../db/connection.js";
import { verifyToken } from "./tokens.js";

export interface PairingRepository {
  create(pairing: PairingCode): PairingCode;
  findByCode(code: string): Promise<PairingCode | undefined>;
  activeBootstrap(now: Date): PairingCode | undefined;
  markUsed(pairingId: PairingCodeId, usedByDeviceId: DeviceId, usedAt: string): PairingCode | undefined;
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
    usedByDeviceId: row.used_by_device_id,
  };
}

export function createSqlitePairingRepository(database: SqliteDatabase): PairingRepository {
  const selectAll = database.prepare("SELECT * FROM pairing_codes ORDER BY expires_at, id");
  const selectById = database.prepare("SELECT * FROM pairing_codes WHERE id = ?");

  return {
    create(pairing) {
      database.prepare(`
        INSERT INTO pairing_codes (id, code_hash, created_by_device_id, expires_at, used_at, used_by_device_id)
        VALUES (@id, @codeHash, @createdByDeviceId, @expiresAt, @usedAt, @usedByDeviceId)
      `).run(pairing);
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
      const row = database.prepare(`
        SELECT * FROM pairing_codes
        WHERE created_by_device_id IS NULL AND used_at IS NULL AND expires_at > ?
        ORDER BY expires_at ASC
        LIMIT 1
      `).get(now.toISOString()) as PairingRow | undefined;
      return row === undefined ? undefined : mapPairing(row);
    },
    markUsed(pairingId, usedByDeviceId, usedAt) {
      database.prepare("UPDATE pairing_codes SET used_at = ?, used_by_device_id = ? WHERE id = ?")
        .run(usedAt, usedByDeviceId, pairingId);
      const row = selectById.get(pairingId) as PairingRow | undefined;
      return row === undefined ? undefined : mapPairing(row);
    },
  };
}

export function createInMemoryPairingRepository(): PairingRepository {
  const pairings = new Map<PairingCodeId, PairingCode>();

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
  };
}
