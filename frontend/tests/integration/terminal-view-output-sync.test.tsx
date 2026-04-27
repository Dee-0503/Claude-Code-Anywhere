import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SERVER_MESSAGE_TYPES, INPUT_ACK_STATUSES } from '../../../shared/protocol/messages.js';
import type { ServerToClientMessage } from '../../../shared/protocol/messages.js';
import type {
  ProtocolClient,
  ProtocolClientEventMap,
  ProtocolClientStatus
} from '../../src/protocol/client.js';

const getTerminalOutputText = vi.fn(() => '');

vi.mock('../../src/terminal/outputRenderer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/terminal/outputRenderer.js')>();
  return {
    ...actual,
    getTerminalOutputText
  };
});

const terminalInstances: Array<{
  openedElement: HTMLElement | null;
  writes: string[];
  dataHandler: ((data: string) => void) | null;
}> = [];

vi.mock('xterm', () => ({
  Terminal: class {
    openedElement: HTMLElement | null = null;
    writes: string[] = [];
    dataHandler: ((data: string) => void) | null = null;

    constructor() {
      terminalInstances.push(this);
    }

    open(element: HTMLElement): void {
      this.openedElement = element;
    }

    onData(handler: (data: string) => void): { dispose(): void } {
      this.dataHandler = handler;
      return { dispose() {} };
    }

    write(data: string): void {
      this.writes.push(data);
    }

    dispose(): void {}
  }
}));

describe('TerminalView output synchronization', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getTerminalOutputText.mockReset();
    terminalInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces fallback text materialization across consecutive output messages', async () => {
    const { TerminalView } = await import('../../src/terminal/TerminalView.js');
    const messageListeners: Array<(message: ServerToClientMessage) => void> = [];
    const client = {
      status: 'open' as ProtocolClientStatus,
      on: vi.fn(
        (
          event: keyof ProtocolClientEventMap,
          listener: (payload: ProtocolClientEventMap[keyof ProtocolClientEventMap]) => void
        ) => {
          if (event === 'message') {
            messageListeners.push(listener as (message: ServerToClientMessage) => void);
          }
          return () => undefined;
        }
      ),
      connect: vi.fn(),
      disconnect: vi.fn(),
      acknowledgeOutput: vi.fn(),
      updateRecoveryOffsets: vi.fn()
    } as unknown as ProtocolClient;
    const container = document.createElement('div');
    const root = createRoot(container);

    getTerminalOutputText.mockReturnValue('alpha\nbeta\ngamma\n');

    act(() => {
      root.render(<TerminalView client={client} credentials={null} instanceId="instance-id" />);
    });

    expect(messageListeners).toHaveLength(1);

    act(() => {
      const emit = messageListeners[0] as (message: ServerToClientMessage) => void;
      emit({
        type: SERVER_MESSAGE_TYPES.OUTPUT,
        instance_id: 'instance-id',
        offset: 0,
        data: 'alpha\n'
      });
      emit({
        type: SERVER_MESSAGE_TYPES.OUTPUT,
        instance_id: 'instance-id',
        offset: 6,
        data: 'beta\n'
      });
      emit({
        type: SERVER_MESSAGE_TYPES.OUTPUT,
        instance_id: 'instance-id',
        offset: 11,
        data: 'gamma\n'
      });
    });

    expect(getTerminalOutputText).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('alpha\nbeta\ngamma');

    act(() => {
      vi.runAllTimers();
    });

    expect(getTerminalOutputText).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('alpha\nbeta\ngamma');
    expect(client.acknowledgeOutput).toHaveBeenCalledTimes(3);
    expect(terminalInstances[0]!.openedElement).toBe(container.querySelector('[role="terminal"]'));
    expect(terminalInstances[0]!.writes).toEqual(['alpha\n', 'beta\n', 'gamma\n']);

    act(() => {
      root.unmount();
    });
  });

  it('ignores duplicate accepted input acknowledgements when advancing recovery offset', async () => {
    const { TerminalView } = await import('../../src/terminal/TerminalView.js');
    const messageListeners: Array<(message: ServerToClientMessage) => void> = [];
    const client = {
      status: 'open' as ProtocolClientStatus,
      on: vi.fn(
        (
          event: keyof ProtocolClientEventMap,
          listener: (payload: ProtocolClientEventMap[keyof ProtocolClientEventMap]) => void
        ) => {
          if (event === 'message') {
            messageListeners.push(listener as (message: ServerToClientMessage) => void);
          }
          return () => undefined;
        }
      ),
      connect: vi.fn(),
      disconnect: vi.fn(),
      acknowledgeOutput: vi.fn(),
      updateRecoveryOffsets: vi.fn()
    } as unknown as ProtocolClient;
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <TerminalView
          client={client}
          credentials={{ device_id: 'device-id', access_token: 'token' }}
          instanceId="instance-id"
        />
      );
    });

    act(() => {
      const emit = messageListeners[0] as (message: ServerToClientMessage) => void;
      emit({
        type: SERVER_MESSAGE_TYPES.INPUT_ACK,
        instance_id: 'instance-id',
        input_id: 'input-1',
        input_offset: 1,
        status: INPUT_ACK_STATUSES.ACCEPTED
      });
      emit({
        type: SERVER_MESSAGE_TYPES.INPUT_ACK,
        instance_id: 'instance-id',
        input_id: 'input-1',
        input_offset: 1,
        status: INPUT_ACK_STATUSES.ACCEPTED
      });
      emit({
        type: SERVER_MESSAGE_TYPES.INPUT_ACK,
        instance_id: 'instance-id',
        input_id: 'input-2',
        input_offset: 2,
        status: INPUT_ACK_STATUSES.DUPLICATE
      });
      emit({
        type: SERVER_MESSAGE_TYPES.INPUT_ACK,
        instance_id: 'instance-id',
        input_id: 'input-3',
        input_offset: 3,
        status: INPUT_ACK_STATUSES.PENDING_CONFIRMATION
      });
    });

    expect(client.updateRecoveryOffsets).toHaveBeenCalledTimes(1);
    expect(client.updateRecoveryOffsets).toHaveBeenCalledWith({ lastInputOffset: 1 });

    act(() => {
      root.unmount();
    });
  });

  it('unsubscribes message handlers so stale socket events cannot update unmounted state', async () => {
    const { TerminalView } = await import('../../src/terminal/TerminalView.js');
    const messageListeners = new Set<(message: ServerToClientMessage) => void>();
    const client = {
      status: 'open' as ProtocolClientStatus,
      on: vi.fn(
        (
          event: keyof ProtocolClientEventMap,
          listener: (payload: ProtocolClientEventMap[keyof ProtocolClientEventMap]) => void
        ) => {
          if (event === 'message') {
            const typedListener = listener as (message: ServerToClientMessage) => void;
            messageListeners.add(typedListener);
            return () => messageListeners.delete(typedListener);
          }
          return () => undefined;
        }
      ),
      connect: vi.fn(),
      disconnect: vi.fn(),
      acknowledgeOutput: vi.fn(),
      updateRecoveryOffsets: vi.fn()
    } as unknown as ProtocolClient;
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(<TerminalView client={client} credentials={null} instanceId="instance-id" />);
    });

    expect(messageListeners.size).toBe(1);

    act(() => {
      root.unmount();
    });

    expect(messageListeners.size).toBe(0);
    for (const listener of messageListeners) {
      listener({
        type: SERVER_MESSAGE_TYPES.OUTPUT,
        instance_id: 'instance-id',
        offset: 0,
        data: 'stale'
      });
    }

    expect(client.acknowledgeOutput).not.toHaveBeenCalled();
  });
});
