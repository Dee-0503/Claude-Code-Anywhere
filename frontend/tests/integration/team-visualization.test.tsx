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
import {
  createTerminalRouteModel,
  fetchInstanceSummaries,
  resolveInstanceIdFromLocation,
  type InstanceSummary,
} from "../../src/pages/App.js";

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

  it("maps backend teammate instances to tabs and deep-link switching", () => {
    const instances: InstanceSummary[] = [
      {
        id: "lead-instance",
        name: "Lead Terminal",
        status: "running",
        last_active_at: "2026-04-25T12:00:00.000Z",
        team_metadata: {
          team_id: "team-1",
          teammate_id: "lead",
          teammate_name: "Lead",
        },
      },
      {
        id: "review-instance",
        name: "Review Terminal",
        status: "running",
        last_active_at: "2026-04-25T12:00:00.000Z",
        team_metadata: {
          team_id: "team-1",
          teammate_id: "reviewer",
          teammate_name: "Reviewer",
        },
      },
    ];
    const routeModel = createTerminalRouteModel(instances, "lead-instance");

    expect(routeModel.teammates).toEqual([
      { instanceId: "lead-instance", teammateName: "Lead", instanceName: "Lead Terminal" },
      { instanceId: "review-instance", teammateName: "Reviewer", instanceName: "Review Terminal" },
    ]);

    const selected: string[] = [];
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <TeamWorkspace
          activeInstanceId={routeModel.activeInstanceId}
          teammates={routeModel.teammates}
          onSelect={(instanceId) => selected.push(instanceId)}
        />,
      );
    });

    expect(container.textContent).toContain("Lead Terminal");
    expect(container.textContent).toContain("Review Terminal");
    const buttons = container.querySelectorAll("button");
    act(() => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(selected).toEqual(["review-instance"]);
    expect(routeModel.createTerminalPath("review-instance")).toBe("/terminal?instance=review-instance");

    act(() => {
      root.unmount();
    });
  });

  it("fetches backend instance summaries with device credentials", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("http://localhost:3000/api/instances?device_id=device-1&access_token=token-1");
      return new Response(JSON.stringify({
        instances: [
          {
            id: "lead-instance",
            name: "Lead Terminal",
            status: "running",
            last_active_at: "2026-04-25T12:00:00.000Z",
            team_metadata: {
              team_id: "team-1",
              teammate_id: "lead",
              teammate_name: "Lead",
            },
          },
        ],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchInstanceSummaries({
      device_id: "device-1",
      access_token: "token-1",
    })).resolves.toEqual([
      {
        id: "lead-instance",
        name: "Lead Terminal",
        status: "running",
        last_active_at: "2026-04-25T12:00:00.000Z",
        team_metadata: {
          team_id: "team-1",
          teammate_id: "lead",
          teammate_name: "Lead",
        },
      },
    ]);

    vi.unstubAllGlobals();
  });

  it("resolves an instance deep link from the URL", () => {
    expect(resolveInstanceIdFromLocation(new URL("https://example.test/terminal?instance=reviewer"))).toBe("reviewer");
    expect(resolveInstanceIdFromLocation(new URL("https://example.test/terminal"))).toBe("default");
  });
});
