import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SERVER_MESSAGE_TYPES } from "../../../shared/protocol/messages.js";
import type { ServerToClientMessage } from "../../../shared/protocol/messages.js";
import type { ProtocolClient, ProtocolClientEventMap, ProtocolClientStatus } from "../../src/protocol/client.js";

const getTerminalOutputText = vi.fn(() => "");

vi.mock("../../src/terminal/outputRenderer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/terminal/outputRenderer.js")>();
  return {
    ...actual,
    getTerminalOutputText,
  };
});

  const terminalInstances: Array<{ openedElement: HTMLElement | null; writes: string[]; dataHandler: ((data: string) => void) | null }> = [];

  vi.mock("xterm", () => ({
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
    },
  }));

describe("TerminalView output synchronization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getTerminalOutputText.mockReset();
    terminalInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces fallback text materialization across consecutive output messages", async () => {
    const { TerminalView } = await import("../../src/terminal/TerminalView.js");
    const messageListeners: Array<(message: ServerToClientMessage) => void> = [];
    const client = {
      status: "open" as ProtocolClientStatus,
      on: vi.fn((event: keyof ProtocolClientEventMap, listener: (payload: ProtocolClientEventMap[keyof ProtocolClientEventMap]) => void) => {
        if (event === "message") {
          messageListeners.push(listener as (message: ServerToClientMessage) => void);
        }
        return () => undefined;
      }),
      connect: vi.fn(),
      disconnect: vi.fn(),
      acknowledgeOutput: vi.fn(),
    } as unknown as ProtocolClient;
    const container = document.createElement("div");
    const root = createRoot(container);

    getTerminalOutputText.mockReturnValue("alpha\nbeta\ngamma\n");

    act(() => {
      root.render(<TerminalView client={client} credentials={null} instanceId="instance-id" />);
    });

    expect(messageListeners).toHaveLength(1);

    act(() => {
      const emit = messageListeners[0] as (message: ServerToClientMessage) => void;
      emit({ type: SERVER_MESSAGE_TYPES.OUTPUT, instance_id: "instance-id", offset: 0, data: "alpha\n" });
      emit({ type: SERVER_MESSAGE_TYPES.OUTPUT, instance_id: "instance-id", offset: 6, data: "beta\n" });
      emit({ type: SERVER_MESSAGE_TYPES.OUTPUT, instance_id: "instance-id", offset: 11, data: "gamma\n" });
    });

    expect(getTerminalOutputText).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("alpha\nbeta\ngamma");

    act(() => {
      vi.runAllTimers();
    });

    expect(getTerminalOutputText).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("alpha\nbeta\ngamma");
    expect(client.acknowledgeOutput).toHaveBeenCalledTimes(3);
    expect(terminalInstances[0]!.openedElement).toBe(container.querySelector('[role="terminal"]'));
    expect(terminalInstances[0]!.writes).toEqual(["alpha\n", "beta\n", "gamma\n"]);

    act(() => {
      root.unmount();
    });
  });
});
