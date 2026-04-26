import { describe, expect, it } from 'vitest';

import {
  CLIENT_MESSAGE_TYPES,
  CONNECTION_STATES,
  INPUT_ACK_STATUSES,
  SERVER_MESSAGE_TYPES
} from '../../../shared/protocol/messages.js';
import { createRemoteTerminalSessionHarness } from '../../src/sessions/remote-terminal-session.js';

describe('weak network input recovery', () => {
  it('retries duplicate input without duplicate PTY injection and confirms queued input after reconnect', async () => {
    const harness = await createRemoteTerminalSessionHarness({
      now: () => new Date('2026-04-25T12:00:00.000Z'),
      ptyScript: ['ready\n']
    });
    const bootstrap = await harness.auth.createBootstrapPairingCode();
    const device = await harness.auth.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Cee iPhone'
    });
    const session = await harness.sessions.attachTerminal({
      device_id: device.device_id,
      access_token: device.access_token,
      last_output_offset: 0
    });

    await session.send({
      type: CLIENT_MESSAGE_TYPES.INPUT,
      instance_id: session.firstMessage.instance_id,
      input_id: 'input-1',
      payload: 'npm test\n'
    });
    await session.send({
      type: CLIENT_MESSAGE_TYPES.INPUT,
      instance_id: session.firstMessage.instance_id,
      input_id: 'input-1',
      payload: 'npm test\n'
    });

    expect(session.messages).toContainEqual({
      type: SERVER_MESSAGE_TYPES.INPUT_ACK,
      instance_id: session.firstMessage.instance_id,
      input_id: 'input-1',
      status: INPUT_ACK_STATUSES.ACCEPTED
    });
    expect(session.messages).toContainEqual({
      type: SERVER_MESSAGE_TYPES.INPUT_ACK,
      instance_id: session.firstMessage.instance_id,
      input_id: 'input-1',
      status: INPUT_ACK_STATUSES.DUPLICATE
    });
    expect(harness.pty.inputs(session.firstMessage.instance_id)).toEqual(['npm test\n']);

    session.markHeartbeat(new Date('2026-04-25T12:00:00.000Z'));
    expect(session.evaluateConnection(new Date('2026-04-25T12:00:02.000Z'))).toEqual({
      type: SERVER_MESSAGE_TYPES.CONNECTION_STATE,
      state: CONNECTION_STATES.DEGRADED
    });

    await session.close();
    const reconnected = await harness.sessions.attachTerminal({
      device_id: device.device_id,
      access_token: device.access_token,
      instance_id: session.firstMessage.instance_id,
      last_output_offset: session.nextOutputOffset
    });

    expect(reconnected.pendingInputConfirmations()).toEqual([]);
  });

  it('keeps disconnected input queued until reconnect confirmation injects it once', async () => {
    const harness = await createRemoteTerminalSessionHarness({
      now: () => new Date('2026-04-25T12:00:00.000Z'),
      ptyScript: ['ready\n']
    });
    const bootstrap = await harness.auth.createBootstrapPairingCode();
    const device = await harness.auth.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Cee iPhone'
    });
    const session = await harness.sessions.attachTerminal({
      device_id: device.device_id,
      access_token: device.access_token,
      last_output_offset: 0
    });

    await session.queueDisconnectedInput({
      input_id: 'offline-1',
      payload: 'git status\n'
    });
    await session.close();

    const reconnected = await harness.sessions.attachTerminal({
      device_id: device.device_id,
      access_token: device.access_token,
      instance_id: session.firstMessage.instance_id,
      last_output_offset: session.nextOutputOffset
    });

    expect(reconnected.pendingInputConfirmations()).toEqual([
      expect.objectContaining({
        id: 'offline-1',
        payload: 'git status\n',
        status: 'queued'
      })
    ]);

    await reconnected.confirmPendingInput(['offline-1']);

    expect(harness.pty.inputs(session.firstMessage.instance_id)).toEqual(['git status\n']);
    expect(reconnected.pendingInputConfirmations()).toEqual([]);
  });
});
