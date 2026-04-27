import { describe, expect, it, vi } from 'vitest';

import { INPUT_ACK_STATUSES, SERVER_MESSAGE_TYPES } from '../../../shared/protocol/messages.js';
import { createInputRecoveryClient } from '../../src/protocol/input-client.js';

function createTransport() {
  const sendInput =
    vi.fn<
      (input: { instanceId: string; inputId: string; inputOffset: number; payload: string }) => void
    >();
  return { sendInput };
}

describe('input recovery client', () => {
  it('retries unacknowledged input with the same input id', () => {
    vi.useFakeTimers();
    const transport = createTransport();
    const client = createInputRecoveryClient({
      deviceId: 'device-id',
      instanceId: 'instance-id',
      transport,
      retryAfterMs: 1_000,
      createInputId: () => 'input-1'
    });

    client.send('npm test\n');
    vi.advanceTimersByTime(1_000);

    expect(transport.sendInput).toHaveBeenCalledTimes(2);
    expect(transport.sendInput).toHaveBeenNthCalledWith(1, {
      instanceId: 'instance-id',
      inputId: 'input-1',
      inputOffset: 1,
      payload: 'npm test\n'
    });
    expect(transport.sendInput).toHaveBeenNthCalledWith(2, {
      instanceId: 'instance-id',
      inputId: 'input-1',
      inputOffset: 1,
      payload: 'npm test\n'
    });
    vi.useRealTimers();
  });

  it('removes pending input after accepted or duplicate ack', () => {
    const transport = createTransport();
    const client = createInputRecoveryClient({
      deviceId: 'device-id',
      instanceId: 'instance-id',
      transport,
      createInputId: () => 'input-1'
    });

    client.send('npm test\n');
    client.handleMessage({
      type: SERVER_MESSAGE_TYPES.INPUT_ACK,
      instance_id: 'instance-id',
      input_id: 'input-1',
      input_offset: 1,
      status: INPUT_ACK_STATUSES.DUPLICATE
    });

    expect(client.pending()).toEqual([]);
  });

  it('keeps pending confirmation input from retrying after pending_confirmation ack', () => {
    vi.useFakeTimers();
    const transport = createTransport();
    const client = createInputRecoveryClient({
      deviceId: 'device-id',
      instanceId: 'instance-id',
      transport,
      retryAfterMs: 1_000,
      createInputId: () => 'interrupt-1'
    });

    client.send('');
    client.handleMessage({
      type: SERVER_MESSAGE_TYPES.INPUT_ACK,
      instance_id: 'instance-id',
      input_id: 'interrupt-1',
      input_offset: 1,
      status: INPUT_ACK_STATUSES.PENDING_CONFIRMATION
    });
    vi.advanceTimersByTime(1_000);

    expect(transport.sendInput).toHaveBeenCalledTimes(1);
    expect(client.pending()).toEqual([
      expect.objectContaining({ inputId: 'interrupt-1', awaitingConfirmation: true })
    ]);
    vi.useRealTimers();
  });

  it('queues offline input until the user confirms replay', () => {
    const transport = createTransport();
    const client = createInputRecoveryClient({
      deviceId: 'device-id',
      instanceId: 'instance-id',
      transport,
      createInputId: () => 'input-1'
    });

    client.setOnline(false);
    client.send('npm test\n');

    expect(transport.sendInput).not.toHaveBeenCalled();
    expect(client.pending()).toEqual([
      expect.objectContaining({ inputId: 'input-1', payload: 'npm test\n' })
    ]);

    client.confirmReplay();

    expect(transport.sendInput).toHaveBeenCalledWith({
      instanceId: 'instance-id',
      inputId: 'input-1',
      inputOffset: 1,
      payload: 'npm test\n'
    });
  });

  it('does not resubmit pending input that was already sent when replay is confirmed', () => {
    const transport = createTransport();
    const client = createInputRecoveryClient({
      deviceId: 'device-id',
      instanceId: 'instance-id',
      transport,
      createInputId: () => 'input-1'
    });

    client.send('npm test\n');
    client.setOnline(false);
    client.confirmReplay();

    expect(transport.sendInput).toHaveBeenCalledTimes(1);
  });
});
