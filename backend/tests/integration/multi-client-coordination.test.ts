import { describe, expect, it } from 'vitest';

import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } from '../../../shared/protocol/messages.js';
import { createRemoteTerminalSessionHarness } from '../../src/sessions/remote-terminal-session.js';

describe('multi-client input coordination', () => {
  it('coordinates queued input, cancellation, and explicit interrupts across two clients', async () => {
    const harness = await createRemoteTerminalSessionHarness({
      now: () => new Date('2026-04-25T12:00:00.000Z'),
      ptyScript: ['ready\n']
    });
    const bootstrap = await harness.auth.createBootstrapPairingCode();
    const admin = await harness.auth.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Cee MacBook'
    });
    const first = await harness.sessions.attachTerminal({
      device_id: admin.device_id,
      access_token: admin.access_token,
      last_output_offset: 0
    });
    const second = await harness.sessions.attachTerminal({
      device_id: admin.device_id,
      access_token: admin.access_token,
      instance_id: first.firstMessage.instance_id,
      last_output_offset: first.nextOutputOffset
    });

    expect(first.presence()).toEqual([
      expect.objectContaining({ deviceId: admin.device_id }),
      expect.objectContaining({ deviceId: admin.device_id })
    ]);

    expect(first.messages).toContainEqual(
      expect.objectContaining({
        type: SERVER_MESSAGE_TYPES.PRESENCE,
        instance_id: first.firstMessage.instance_id,
        devices: expect.arrayContaining([expect.objectContaining({ device_id: admin.device_id })])
      })
    );
    expect(second.messages).toContainEqual(
      expect.objectContaining({
        type: SERVER_MESSAGE_TYPES.PRESENCE,
        instance_id: first.firstMessage.instance_id,
        devices: expect.arrayContaining([expect.objectContaining({ device_id: admin.device_id })])
      })
    );

    await first.queueDisconnectedInput({ input_id: 'mac-queued', payload: 'npm test\n' });
    await second.queueDisconnectedInput({ input_id: 'phone-queued', payload: 'git status\n' });
    expect(second.messages).toContainEqual(
      expect.objectContaining({
        type: SERVER_MESSAGE_TYPES.QUEUED_INPUTS,
        instance_id: first.firstMessage.instance_id,
        inputs: [
          expect.objectContaining({
            input_id: 'mac-queued',
            device_id: admin.device_id,
            status: 'queued'
          }),
          expect.objectContaining({
            input_id: 'phone-queued',
            device_id: admin.device_id,
            status: 'queued'
          })
        ]
      })
    );
    expect(second.queuedInputs().map((message) => message.id)).toEqual([
      'mac-queued',
      'phone-queued'
    ]);

    await second.send({
      type: CLIENT_MESSAGE_TYPES.CANCEL_INPUT,
      instance_id: first.firstMessage.instance_id,
      input_id: 'phone-queued'
    });
    expect(first.messages).toContainEqual(
      expect.objectContaining({
        type: SERVER_MESSAGE_TYPES.QUEUED_INPUTS,
        instance_id: first.firstMessage.instance_id,
        inputs: [expect.objectContaining({ input_id: 'mac-queued', status: 'queued' })]
      })
    );
    expect(first.messages).not.toContainEqual(
      expect.objectContaining({
        type: SERVER_MESSAGE_TYPES.QUEUED_INPUTS,
        inputs: expect.arrayContaining([expect.objectContaining({ status: 'cancelled' })])
      })
    );
    await first.confirmPendingInput(['mac-queued', 'phone-queued']);
    expect(harness.pty.inputs(first.firstMessage.instance_id)).toEqual(['npm test\n']);

    await second.send({
      type: CLIENT_MESSAGE_TYPES.INPUT,
      instance_id: first.firstMessage.instance_id,
      input_id: 'interrupt-1',
      payload: ''
    });
    expect(second.interruptConfirmations()).toEqual([
      expect.objectContaining({ inputId: 'interrupt-1', deviceId: admin.device_id })
    ]);
    expect(harness.pty.inputs(first.firstMessage.instance_id)).toEqual(['npm test\n']);

    await first.send({
      type: CLIENT_MESSAGE_TYPES.CONFIRM_INTERRUPT,
      instance_id: first.firstMessage.instance_id,
      input_id: 'interrupt-1'
    });
    expect(harness.pty.inputs(first.firstMessage.instance_id)).toEqual(['npm test\n', '']);
    expect(first.interruptConfirmations()).toEqual([]);

    await second.send({
      type: CLIENT_MESSAGE_TYPES.INPUT,
      instance_id: first.firstMessage.instance_id,
      input_id: 'interrupt-2',
      payload: ''
    });
    await first.send({
      type: CLIENT_MESSAGE_TYPES.CANCEL_INTERRUPT,
      instance_id: first.firstMessage.instance_id,
      input_id: 'interrupt-2'
    });
    expect(harness.pty.inputs(first.firstMessage.instance_id)).toEqual(['npm test\n', '']);
    expect(first.interruptConfirmations()).toEqual([]);
  });
});
