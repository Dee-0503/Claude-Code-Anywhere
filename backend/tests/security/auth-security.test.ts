import { describe, expect, it } from 'vitest';

import { CLAUDE_INSTANCE_STATUSES, DEVICE_ROLES } from '../../../shared/protocol/domain.js';
import {
  authenticateWebSocketConnection,
  rejectInvalidWebSocketRequestPolicy
} from '../../src/api/websocket-auth.js';
import { createInMemoryDeviceRepository } from '../../src/auth/device-repository.js';
import { createInMemoryPairingRepository } from '../../src/auth/pairing-repository.js';
import { createBootstrapPairingService } from '../../src/auth/pairing-service.js';
import { hashToken, verifyToken } from '../../src/auth/tokens.js';
import { createInMemoryInstanceRepository } from '../../src/sessions/instance-repository.js';
import { createInstanceService } from '../../src/sessions/instance-service.js';

const NOW = new Date('2026-04-25T12:00:00.000Z');
const TEN_MINUTES_MS = 10 * 60 * 1000;

function createAuthenticatedAttachFixture() {
  const service = createBootstrapPairingService({
    now: () => NOW,
    pairingTtlMs: TEN_MINUTES_MS
  });
  const instances = createInstanceService({
    repository: createInMemoryInstanceRepository(),
    now: () => NOW
  });

  return { service, instances };
}

describe('auth security', () => {
  it('rejects revoked device tokens at the websocket authentication boundary', async () => {
    const { service, instances } = createAuthenticatedAttachFixture();
    const bootstrap = await service.createBootstrapPairingCode();
    const admin = await service.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Admin browser'
    });
    await service.revokeDevice({
      admin_device_id: admin.device_id,
      access_token: admin.access_token,
      target_device_id: admin.device_id
    });

    await expect(
      authenticateWebSocketConnection(
        {
          device_id: admin.device_id,
          access_token: admin.access_token,
          instance_id: 'main',
          last_output_offset: 0,
          last_input_offset: 0
        },
        {
          verifyDeviceToken: service.verifyDeviceToken,
          findInstanceById: instances.getInstance,
          findAttachableInstanceForDevice: (instanceId, deviceId) =>
            instances.getInstanceForDevice(instanceId, deviceId)
        }
      )
    ).rejects.toMatchObject({ code: 'DEVICE_REVOKED' });
  });

  it('rejects websocket attaches without a token before instance lookup', async () => {
    const { service, instances } = createAuthenticatedAttachFixture();
    const bootstrap = await service.createBootstrapPairingCode();
    const admin = await service.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Admin browser'
    });
    const { instance } = instances.startInstance({
      cwd: '/workspace',
      createdByDeviceId: admin.device_id
    });

    await expect(
      authenticateWebSocketConnection(
        {
          device_id: admin.device_id,
          access_token: '',
          instance_id: instance.id,
          last_output_offset: 0,
          last_input_offset: 0
        },
        {
          verifyDeviceToken: service.verifyDeviceToken,
          findInstanceById: instances.getInstance,
          findAttachableInstanceForDevice: (instanceId, deviceId) =>
            instances.getInstanceForDevice(instanceId, deviceId)
        }
      )
    ).rejects.toMatchObject({ code: 'MISSING_WEBSOCKET_TOKEN', statusCode: 401 });
  });

  it('rejects invalid websocket attach tokens', async () => {
    const { service, instances } = createAuthenticatedAttachFixture();
    const bootstrap = await service.createBootstrapPairingCode();
    const admin = await service.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Admin browser'
    });
    const { instance } = instances.startInstance({
      cwd: '/workspace',
      createdByDeviceId: admin.device_id
    });

    await expect(
      authenticateWebSocketConnection(
        {
          device_id: admin.device_id,
          access_token: 'tampered-token',
          instance_id: instance.id,
          last_output_offset: 0,
          last_input_offset: 0
        },
        {
          verifyDeviceToken: service.verifyDeviceToken,
          findInstanceById: instances.getInstance,
          findAttachableInstanceForDevice: (instanceId, deviceId) =>
            instances.getInstanceForDevice(instanceId, deviceId)
        }
      )
    ).rejects.toMatchObject({ code: 'INVALID_DEVICE_TOKEN', statusCode: 401 });
  });

  it('rejects websocket attaches when a valid token is not authorized for the target instance', async () => {
    const { service, instances } = createAuthenticatedAttachFixture();
    const bootstrap = await service.createBootstrapPairingCode();
    const admin = await service.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Admin browser'
    });
    const pairing = await service.createPairingCode({
      device_id: admin.device_id,
      access_token: admin.access_token,
      target_name_hint: 'Member browser'
    });
    const member = await service.consumePairingCode({
      pairing_code: pairing.pairing_code,
      device_name: 'Member browser'
    });
    const { instance } = instances.startInstance({
      cwd: '/workspace',
      createdByDeviceId: admin.device_id
    });

    await expect(
      authenticateWebSocketConnection(
        {
          device_id: member.device_id,
          access_token: member.access_token,
          instance_id: instance.id,
          last_output_offset: 0,
          last_input_offset: 0
        },
        {
          verifyDeviceToken: service.verifyDeviceToken,
          findInstanceById: instances.getInstance,
          findAttachableInstanceForDevice: (instanceId, deviceId) =>
            instances.getInstanceForDevice(instanceId, deviceId)
        }
      )
    ).rejects.toMatchObject({ code: 'WEBSOCKET_INSTANCE_FORBIDDEN', statusCode: 403 });
  });

  it('rejects websocket attaches to missing or non-attachable instances', async () => {
    const { service, instances } = createAuthenticatedAttachFixture();
    const bootstrap = await service.createBootstrapPairingCode();
    const admin = await service.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Admin browser'
    });
    const { instance } = instances.startInstance({
      cwd: '/workspace',
      createdByDeviceId: admin.device_id
    });
    instances.repository.update({
      ...instance,
      status: CLAUDE_INSTANCE_STATUSES.EXITED,
      exitedAt: NOW.toISOString()
    });

    await expect(
      authenticateWebSocketConnection(
        {
          device_id: admin.device_id,
          access_token: admin.access_token,
          instance_id: 'missing-instance',
          last_output_offset: 0,
          last_input_offset: 0
        },
        {
          verifyDeviceToken: service.verifyDeviceToken,
          findInstanceById: instances.getInstance,
          findAttachableInstanceForDevice: (instanceId, deviceId) =>
            instances.getInstanceForDevice(instanceId, deviceId)
        }
      )
    ).rejects.toMatchObject({ code: 'WEBSOCKET_INSTANCE_NOT_FOUND', statusCode: 404 });

    await expect(
      authenticateWebSocketConnection(
        {
          device_id: admin.device_id,
          access_token: admin.access_token,
          instance_id: instance.id,
          last_output_offset: 0,
          last_input_offset: 0
        },
        {
          verifyDeviceToken: service.verifyDeviceToken,
          findInstanceById: instances.getInstance,
          findAttachableInstanceForDevice: (instanceId, deviceId) =>
            instances.getInstanceForDevice(instanceId, deviceId)
        }
      )
    ).rejects.toMatchObject({ code: 'WEBSOCKET_INSTANCE_NOT_ATTACHABLE', statusCode: 404 });
  });

  it('rejects websocket requests with paths or origins outside configured policy', () => {
    expect(() =>
      rejectInvalidWebSocketRequestPolicy({
        path: '/api/ws/terminal',
        origin: 'https://console.example.com',
        allowedPath: '/ws',
        allowedOrigins: ['https://console.example.com']
      })
    ).toThrow(expect.objectContaining({ code: 'INVALID_WEBSOCKET_PATH', statusCode: 400 }));

    expect(() =>
      rejectInvalidWebSocketRequestPolicy({
        path: '/ws',
        origin: 'https://evil.example.com',
        allowedPath: '/ws',
        allowedOrigins: ['https://console.example.com']
      })
    ).toThrow(expect.objectContaining({ code: 'WEBSOCKET_ORIGIN_DENIED', statusCode: 403 }));
  });

  it('does not create or mark a device when consuming an expired pairing code', async () => {
    let currentTime = NOW;
    const devices = createInMemoryDeviceRepository();
    const pairings = createInMemoryPairingRepository();
    const service = createBootstrapPairingService({
      now: () => currentTime,
      pairingTtlMs: TEN_MINUTES_MS,
      devices,
      pairings
    });
    const { pairing_code } = await service.createBootstrapPairingCode();
    currentTime = new Date(NOW.getTime() + TEN_MINUTES_MS + 1);

    await expect(
      service.consumePairingCode({
        pairing_code,
        device_name: 'Late browser'
      })
    ).rejects.toMatchObject({ code: 'PAIRING_CODE_EXPIRED' });

    expect(devices.list()).toEqual([]);
    const storedPairing = await pairings.findByCode(pairing_code);
    expect(storedPairing?.usedAt).toBeNull();
    expect(storedPairing?.usedByDeviceId).toBeNull();
  });

  it('rejects token tampering, swapped tokens, and hash strings as bearer tokens', async () => {
    const devices = createInMemoryDeviceRepository();
    const alphaToken = 'alpha-token-0000000000000000';
    const betaToken = 'beta-token-00000000000000000';
    const alphaHash = await hashToken(alphaToken);
    const betaHash = await hashToken(betaToken);
    devices.create({
      id: 'alpha',
      name: 'Alpha',
      role: DEVICE_ROLES.ADMIN,
      tokenHash: alphaHash,
      createdAt: NOW.toISOString(),
      lastSeenAt: NOW.toISOString(),
      revokedAt: null
    });
    devices.create({
      id: 'beta',
      name: 'Beta',
      role: DEVICE_ROLES.MEMBER,
      tokenHash: betaHash,
      createdAt: NOW.toISOString(),
      lastSeenAt: NOW.toISOString(),
      revokedAt: null
    });

    await expect(devices.verifyToken('alpha', `${alphaToken}-tampered`)).resolves.toBeUndefined();
    await expect(devices.verifyToken('alpha', betaToken)).resolves.toBeUndefined();
    await expect(devices.verifyToken('alpha', alphaHash)).resolves.toBeUndefined();
    await expect(verifyToken(alphaToken, alphaHash)).resolves.toBe(true);
  });
});
