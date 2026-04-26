import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { SERVER_MESSAGE_TYPES, type OutputMessagePayload } from "../../../shared/protocol/messages.js";
import { TerminalSearch, countTerminalSearchMatches } from "../../src/components/TerminalSearch.js";
import { appendTerminalOutput } from "../../src/terminal/outputRenderer.js";

function renderSearch(output: string): { container: HTMLDivElement; root: ReturnType<typeof createRoot> } {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(<TerminalSearch output={output} />);
  });

  return { container, root };
}

describe("terminal display", () => {
  it("searches terminal output and moves between matches", () => {
    const { container, root } = renderSearch("first error\nsecond line\nlast error");
    const input = container.querySelector("input");

    expect(countTerminalSearchMatches("first error\nsecond line\nlast error", "error")).toBe(2);

    act(() => {
      if (input instanceof HTMLInputElement) {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(input, "error");
      }
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.textContent).toContain("1 / 2");

    const nextButton = container.querySelectorAll("button")[1];
    act(() => {
      nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("2 / 2");

    act(() => {
      root.unmount();
    });
  });

  it("appends output through a bounded renderer and reports scroll position", () => {
    const terminal = { write: vi.fn() };
    const messages: OutputMessagePayload[] = [
      { type: SERVER_MESSAGE_TYPES.OUTPUT, instance_id: "instance-id", offset: 0, data: "alpha\n" },
      { type: SERVER_MESSAGE_TYPES.OUTPUT, instance_id: "instance-id", offset: 6, data: "beta\n" },
    ];

    const state = messages.reduce(
      (current, message) => appendTerminalOutput(current, message, terminal),
      { text: "", scrollOffset: 0, maxLength: 10 },
    );

    expect(terminal.write).toHaveBeenCalledWith("alpha\n");
    expect(terminal.write).toHaveBeenCalledWith("beta\n");
    expect(state.text).toBe("lpha\nbeta\n");
    expect(state.scrollOffset).toBe(1);
  });
});
