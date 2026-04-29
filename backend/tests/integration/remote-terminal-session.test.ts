import { describe, expect, it } from 'vitest';

import { DEVICE_ROLES } from '../../../shared/protocol/domain.js';
import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } from '../../../shared/protocol/messages.js';
import { createRemoteTerminalSessionHarness } from '../../src/sessions/remote-terminal-session.js';

describe('remote terminal session integration', () => {
  it('pairs the first browser device, attaches it to a Claude terminal, and replays output on reconnect', async () => {
    const harness = await createRemoteTerminalSessionHarness({
      now: () => new Date('2026-04-25T12:00:00.000Z'),
      outputBufferBytes: 1024 * 1024,
      ptyScript: ['Claude Code ready\n', 'workspace $ ']
    });

    const bootstrap = await harness.auth.createBootstrapPairingCode();
    const device = await harness.auth.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: 'Cee iPhone'
    });

    expect(device).toMatchObject({
      device_id: expect.any(String),
      access_token: expect.any(String),
      role: DEVICE_ROLES.ADMIN
    });

    const session = await harness.sessions.attachTerminal({
      device_id: device.device_id,
      access_token: device.access_token,
      cwd: '/Users/ceemac/my_product/Claude Code Anywhere',
      last_output_offset: 0
    });

    expect(session.firstMessage).toMatchObject({
      type: SERVER_MESSAGE_TYPES.HELLO,
      instance_id: expect.any(String),
      connection_id: expect.any(String),
      next_output_offset: expect.any(Number)
    });
    expect(session.messages).toContainEqual(
      expect.objectContaining({
        type: SERVER_MESSAGE_TYPES.OUTPUT,
        instance_id: session.firstMessage.instance_id,
        offset: 0,
        data: expect.stringContaining('Claude Code ready')
      })
    );

    await session.send({
      type: CLIENT_MESSAGE_TYPES.ACK_OUTPUT,
      instance_id: session.firstMessage.instance_id,
      offset: session.nextOutputOffset
    });
    await session.close();

    await harness.pty.write(session.firstMessage.instance_id, 'after reconnect\n');

    const reconnected = await harness.sessions.attachTerminal({
      device_id: device.device_id,
      access_token: device.access_token,
      instance_id: session.firstMessage.instance_id,
      last_output_offset: session.nextOutputOffset
    });

    expect(reconnected.firstMessage).toMatchObject({
      type: SERVER_MESSAGE_TYPES.HELLO,
      instance_id: session.firstMessage.instance_id
    });
    expect(reconnected.messages).toContainEqual(
      expect.objectContaining({
        type: SERVER_MESSAGE_TYPES.OUTPUT,
        instance_id: session.firstMessage.instance_id,
        offset: session.nextOutputOffset,
        data: 'after reconnect\n'
      })
    );
  });
});
