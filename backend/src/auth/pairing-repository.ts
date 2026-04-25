import type { DeviceId, PairingCode, PairingCodeId } from "../../../shared/protocol/domain.js";
import { verifyToken } from "./tokens.js";

export interface PairingRepository {
  create(pairing: PairingCode): PairingCode;
  findByCode(code: string): PairingCode | undefined;
  activeBootstrap(now: Date): PairingCode | undefined;
  markUsed(pairingId: PairingCodeId, usedByDeviceId: DeviceId, usedAt: string): PairingCode | undefined;
}

export function createInMemoryPairingRepository(): PairingRepository {
  const pairings = new Map<PairingCodeId, PairingCode>();

  return {
    create(pairing) {
      pairings.set(pairing.id, pairing);
      return pairing;
    },
    findByCode(code) {
      for (const pairing of pairings.values()) {
        if (verifyToken(code, pairing.codeHash)) {
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
