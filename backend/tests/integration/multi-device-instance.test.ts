import { describe, expect, it } from 'vitest';

import { DEVICE_ROLES } from '../../../shared/protocol/domain.js';
import { createInMemoryDeviceRepository } from '../../src/auth/device-repository.js';
import { createBootstrapPairingService } from '../../src/auth/pairing-service.js';
import { generateToken, hashToken } from '../../src/auth/tokens.js';
import { createRemoteTerminalSessionHarness } from '../../src/sessions/remote-terminal-session.js';

describe('multi-device instance management', () => {
  it('pairs a second device, switches between two instances, stops one, and rejects a revoked device', async () => {
    const devices = createInMemoryDeviceRepository();
    const adminToken = generateToken();
    const memberToken = generateToken();
    devices.create({
      id: 'admin-device',
      name: 'Cee MacBook',
      role: DEVICE_ROLES.ADMIN,
      tokenHash: await hashToken(adminToken),
      createdAt: '2026-04-25T12:00:00.000Z',
      lastSeenAt: '2026-04-25T12:00:00.000Z',
      revokedAt: null
    });
    devices.create({
      id: 'member-device',
      name: 'Cee iPhone',
      role: DEVICE_ROLES.MEMBER,
      tokenHash: await hashToken(memberToken),
      createdAt: '2026-04-25T12:00:00.000Z',
      lastSeenAt: '2026-04-25T12:00:00.000Z',
      revokedAt: null
    });
    const auth = createBootstrapPairingService({
      now: () => new Date('2026-04-25T12:00:00.000Z'),
      devices
    });
    const harness = await createRemoteTerminalSessionHarness({
      auth,
      now: () => new Date('2026-04-25T12:00:00.000Z'),
      ptyScript: ['ready\n']
    });

    const first = await harness.sessions.attachTerminal({
      device_id: 'admin-device',
      access_token: adminToken,
      cwd: '/workspace/one',
      last_output_offset: 0
    });
    const second = await harness.sessions.createInstance({
      device_id: 'admin-device',
      access_token: adminToken,
      name: 'second',
      cwd: '/workspace/two'
    });
    const switched = await harness.sessions.attachTerminal({
      device_id: 'admin-device',
      access_token: adminToken,
      instance_id: second.id,
      last_output_offset: 0
    });

    expect(switched.firstMessage.instance_id).toBe(second.id);
    expect(harness.sessions.listInstances()).toEqual([
      expect.objectContaining({ id: first.firstMessage.instance_id, status: 'running' }),
      expect.objectContaining({ id: second.id, name: 'second', status: 'running' })
    ]);

    expect(
      await harness.sessions.stopInstance({
        device_id: 'admin-device',
        access_token: adminToken,
        instance_id: second.id
      })
    ).toMatchObject({ id: second.id, status: 'exited' });

    await harness.auth.revokeDevice({
      admin_device_id: 'admin-device',
      access_token: adminToken,
      target_device_id: 'member-device'
    });
    await expect(
      harness.sessions.attachTerminal({
        device_id: 'member-device',
        access_token: memberToken,
        instance_id: first.firstMessage.instance_id,
        last_output_offset: 0
      })
    ).rejects.toMatchObject({ code: 'DEVICE_REVOKED' });
  });

  it('rejects cross-device attach, stop, output replay, input, and input acknowledgement access', async () => {
    const devices = createInMemoryDeviceRepository();
    const ownerToken = generateToken();
    const otherToken = generateToken();
    devices.create({
      id: 'owner-device',
      name: 'Owner browser',
      role: DEVICE_ROLES.ADMIN,
      tokenHash: await hashToken(ownerToken),
      createdAt: '2026-04-25T12:00:00.000Z',
      lastSeenAt: '2026-04-25T12:00:00.000Z',
      revokedAt: null
    });
    devices.create({
      id: 'other-device',
      name: 'Other browser',
      role: DEVICE_ROLES.MEMBER,
      tokenHash: await hashToken(otherToken),
      createdAt: '2026-04-25T12:00:00.000Z',
      lastSeenAt: '2026-04-25T12:00:00.000Z',
      revokedAt: null
    });
    const auth = createBootstrapPairingService({
      now: () => new Date('2026-04-25T12:00:00.000Z'),
      devices
    });
    const harness = await createRemoteTerminalSessionHarness({
      auth,
      now: () => new Date('2026-04-25T12:00:00.000Z'),
      ptyScript: ['secret output\n']
    });

    const owner = await harness.sessions.attachTerminal({
      device_id: 'owner-device',
      access_token: ownerToken,
      cwd: '/workspace/owner',
      last_output_offset: 0
    });
    const instanceId = owner.firstMessage.instance_id;
    await owner.send({
      type: 'input',
      instance_id: instanceId,
      input_id: 'owner-input',
      payload: 'npm test\n'
    });

    await expect(
      harness.sessions.attachTerminal({
        device_id: 'other-device',
        access_token: otherToken,
        instance_id: instanceId,
        last_output_offset: 0
      })
    ).rejects.toMatchObject({ code: 'INSTANCE_UNAVAILABLE' });
    await expect(
      harness.sessions.stopInstance({
        device_id: 'other-device',
        access_token: otherToken,
        instance_id: instanceId
      })
    ).rejects.toMatchObject({ code: 'INSTANCE_UNAVAILABLE' });
    await expect(
      owner.send({
        type: 'input',
        instance_id: 'other-instance',
        input_id: 'cross-input',
        payload: 'whoami\n'
      })
    ).rejects.toMatchObject({ code: 'INSTANCE_UNAVAILABLE' });
    await expect(
      owner.confirmPendingInput(['cross-input'], 'other-instance')
    ).rejects.toMatchObject({ code: 'INSTANCE_UNAVAILABLE' });
    expect(harness.pty.inputs(instanceId)).toEqual(['npm test\n']);
  });
});
