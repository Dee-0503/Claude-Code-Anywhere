import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("xterm", () => ({
  Terminal: class {
    open(): void {}
    onData(): { dispose: () => void } {
      return { dispose() {} };
    }
    write(): void {}
    scrollToLine(): void {}
    dispose(): void {}
  },
}));

import { TeamWorkspace, renderTeamWorkspace } from "../../src/components/TeamWorkspace.js";
import { resolveInstanceIdFromLocation } from "../../src/pages/App.js";

describe("team visualization", () => {
  it("renders teammate tabs and switches the active pane", () => {
    expect(renderTeamWorkspace({
      activeInstanceId: "lead",
      teammates: [
        { instanceId: "lead", teammateName: "Lead", instanceName: "Lead Terminal" },
        { instanceId: "reviewer", teammateName: "Reviewer", instanceName: "Review Terminal" },
      ],
    })).toContain("当前 teammate：Lead");

    const selected: string[] = [];
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <TeamWorkspace
          activeInstanceId="lead"
          teammates={[
            { instanceId: "lead", teammateName: "Lead", instanceName: "Lead Terminal" },
            { instanceId: "reviewer", teammateName: "Reviewer", instanceName: "Review Terminal" },
          ]}
          onSelect={(instanceId) => selected.push(instanceId)}
        />,
      );
    });

    expect(container.textContent).toContain("Lead Terminal");
    const buttons = container.querySelectorAll("button");
    act(() => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(selected).toEqual(["reviewer"]);

    act(() => {
      root.unmount();
    });
  });

  it("resolves an instance deep link from the URL", () => {
    expect(resolveInstanceIdFromLocation(new URL("https://example.test/terminal?instance=reviewer"))).toBe("reviewer");
    expect(resolveInstanceIdFromLocation(new URL("https://example.test/terminal"))).toBe("default");
  });
});
