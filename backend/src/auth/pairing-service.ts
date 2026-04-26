import { createHash, randomInt, randomUUID } from 'node:crypto';

import {
  DEVICE_ROLES,
  type Device,
  type DeviceId,
  type DeviceRole
} from '../../../shared/protocol/domain.js';
import { createApiError } from '../api/errors.js';
import { createInMemoryDeviceRepository, type DeviceRepository } from './device-repository.js';
import { createInMemoryPairingRepository, type PairingRepository } from './pairing-repository.js';
import { generateToken, hashToken } from './tokens.js';

export interface PairingServiceOptions {
  readonly now?: () => Date;
  readonly pairingTtlMs?: number;
  readonly devices?: DeviceRepository;
  readonly pairings?: PairingRepository;
  readonly maxFailedPairingAttempts?: number;
  readonly pairingAttemptCooldownMs?: number;
}

export interface PairingCodeResponse {
  readonly pairing_code: string;
  readonly expires_at: string;
}

export interface ConsumePairingCodeInput {
  readonly pairing_code: string;
  readonly device_name: string;
  readonly requester_key?: string;
}

export interface PairedDeviceResponse {
  readonly device_id: string;
  readonly access_token: string;
  readonly role: DeviceRole;
}

export interface AuthenticatedDeviceInput {
  readonly device_id: string;
  readonly access_token: string;
}

export interface RevokeDeviceInput {
  readonly device_id?: string;
  readonly admin_device_id?: DeviceId;
  readonly access_token: string;
  readonly target_device_id: DeviceId;
}

function serviceError(code: string, message: string): Error & { code: string } {
  return createApiError(code as never, message) as Error & { code: string };
}

function generatePairingCode(): string {
  return `${randomInt(0, 1_000).toString().padStart(3, '0')}-${randomInt(0, 1_000)
    .toString()
    .padStart(3, '0')}`;
}

export function createBootstrapPairingService(options: PairingServiceOptions = {}) {
  const now = options.now ?? (() => new Date());
  const pairingTtlMs = options.pairingTtlMs ?? 10 * 60 * 1000;
  const devices = options.devices ?? createInMemoryDeviceRepository();
  const pairings = options.pairings ?? createInMemoryPairingRepository();
  const maxFailedPairingAttempts = options.maxFailedPairingAttempts ?? 5;
  const pairingAttemptCooldownMs = options.pairingAttemptCooldownMs ?? 5 * 60 * 1000;

  function attemptKey(input: ConsumePairingCodeInput): string {
    const requesterKey = input.requester_key?.trim();
    if (requesterKey !== undefined && requesterKey.length > 0) {
      const digest = createHash('sha256')
        .update('requester_key:')
        .update(requesterKey)
        .digest('hex');
      return `pairing-consume:requester:${digest}`;
    }
    const digest = createHash('sha256')
      .update('pairing_code:')
      .update(input.pairing_code)
      .digest('hex');
    return `pairing-consume:code:${digest}`;
  }

  function assertNotLocked(key: string, timestamp: Date): void {
    const state = pairings.getAttemptState(key);
    if (state?.lockedUntil !== null && state?.lockedUntil !== undefined) {
      const lockedUntil = new Date(state.lockedUntil);
      if (lockedUntil.getTime() > timestamp.getTime()) {
        throw serviceError('PAIRING_ATTEMPTS_LOCKED', 'Pairing attempts temporarily locked');
      }
      pairings.clearAttemptState(key);
    }
  }

  function recordFailedAttempt(key: string, timestamp: Date): void {
    pairings.recordFailedAttempt({
      key,
      failedAt: timestamp,
      maxFailedAttempts: maxFailedPairingAttempts,
      cooldownMs: pairingAttemptCooldownMs
    });
  }

  async function verifyDeviceToken(
    input: AuthenticatedDeviceInput
  ): Promise<Device & { device_id: string }> {
    const device = devices.getById(input.device_id);
    if (device?.revokedAt !== null && device?.revokedAt !== undefined) {
      throw serviceError('DEVICE_REVOKED', 'Device has been revoked');
    }

    const verified = await devices.verifyToken(input.device_id, input.access_token);
    if (verified === undefined) {
      throw serviceError('INVALID_DEVICE_TOKEN', 'Invalid device token');
    }
    if (verified.revokedAt !== null) {
      throw serviceError('DEVICE_REVOKED', 'Device has been revoked');
    }

    const updated = devices.updateLastSeen(verified.id, now().toISOString()) ?? verified;
    return { ...updated, device_id: updated.id };
  }

  async function createBootstrapPairingCode(): Promise<PairingCodeResponse> {
    const timestamp = now();
    if (devices.hasActiveAdmin() || pairings.activeBootstrap(timestamp) !== undefined) {
      throw serviceError('BOOTSTRAP_PAIRING_ALREADY_ACTIVE', 'Bootstrap pairing already exists');
    }

    const code = generatePairingCode();
    const expiresAt = new Date(timestamp.getTime() + pairingTtlMs).toISOString();
    pairings.create({
      id: randomUUID(),
      codeHash: await hashToken(code),
      createdByDeviceId: null,
      expiresAt,
      usedAt: null,
      usedByDeviceId: null
    });

    return { pairing_code: code, expires_at: expiresAt };
  }

  async function createPairingCode(
    input: AuthenticatedDeviceInput & { readonly target_name_hint?: string }
  ): Promise<PairingCodeResponse> {
    const admin = await verifyDeviceToken(input);
    if (admin.role !== DEVICE_ROLES.ADMIN) {
      throw serviceError('ADMIN_REQUIRED', 'Admin device required');
    }

    const timestamp = now();
    const code = generatePairingCode();
    const expiresAt = new Date(timestamp.getTime() + pairingTtlMs).toISOString();
    pairings.create({
      id: randomUUID(),
      codeHash: await hashToken(code),
      createdByDeviceId: admin.id,
      expiresAt,
      usedAt: null,
      usedByDeviceId: null
    });

    return { pairing_code: code, expires_at: expiresAt };
  }

  async function consumePairingCode(input: ConsumePairingCodeInput): Promise<PairedDeviceResponse> {
    const timestamp = now();
    const key = attemptKey(input);
    assertNotLocked(key, timestamp);

    const pairing = await pairings.findByCode(input.pairing_code);
    if (pairing === undefined) {
      recordFailedAttempt(key, timestamp);
      throw serviceError('PAIRING_CODE_INVALID', 'Invalid pairing code');
    }
    if (pairing.usedAt !== null) {
      recordFailedAttempt(key, timestamp);
      throw serviceError('PAIRING_CODE_ALREADY_USED', 'Pairing code already used');
    }
    if (new Date(pairing.expiresAt).getTime() <= timestamp.getTime()) {
      recordFailedAttempt(key, timestamp);
      throw serviceError('PAIRING_CODE_EXPIRED', 'Pairing code expired');
    }

    const accessToken = generateToken();
    const issuedAt = timestamp.toISOString();
    const role = pairing.createdByDeviceId === null ? DEVICE_ROLES.ADMIN : DEVICE_ROLES.MEMBER;
    const device = devices.create({
      id: randomUUID(),
      name: input.device_name,
      role,
      tokenHash: await hashToken(accessToken),
      createdAt: issuedAt,
      lastSeenAt: issuedAt,
      revokedAt: null
    });
    const claimed = pairings.claim(pairing.id, device.id, issuedAt, timestamp);
    if (claimed === undefined) {
      devices.delete(device.id);
      recordFailedAttempt(key, timestamp);
      throw serviceError('PAIRING_CODE_ALREADY_USED', 'Pairing code already used');
    }

    pairings.clearAttemptState(key);
    return { device_id: device.id, access_token: accessToken, role };
  }

  async function revokeDevice(input: RevokeDeviceInput): Promise<void> {
    const adminDeviceId = input.admin_device_id ?? input.device_id;
    if (adminDeviceId === undefined) {
      throw serviceError('INVALID_DEVICE_TOKEN', 'Admin device id is required');
    }

    const admin = await verifyDeviceToken({
      device_id: adminDeviceId,
      access_token: input.access_token
    });
    if (admin.role !== DEVICE_ROLES.ADMIN) {
      throw serviceError('ADMIN_REQUIRED', 'Admin device required');
    }
    devices.revoke(input.target_device_id, now().toISOString());
  }

  return {
    createBootstrapPairingCode,
    createPairingCode,
    consumePairingCode,
    verifyDeviceToken,
    revokeDevice
  };
}

export type BootstrapPairingService = ReturnType<typeof createBootstrapPairingService>;
