import { describe, expect, it } from "vitest";

import { detectTeamSessions } from "../../src/sessions/team-detector.js";

describe("team session detection", () => {
  it("groups Claude instances by teammate metadata", () => {
    const sessions = detectTeamSessions([
      { instanceId: "lead", instanceName: "Team Lead", teammateId: "lead", teammateName: "Lead", teamId: "team-1" },
      { instanceId: "reviewer", instanceName: "Reviewer", teammateId: "reviewer", teammateName: "Reviewer", teamId: "team-1" },
      { instanceId: "solo", instanceName: "Solo" },
    ]);

    expect(sessions).toEqual([
      {
        teamId: "team-1",
        teammates: [
          { instanceId: "lead", instanceName: "Team Lead", teammateId: "lead", teammateName: "Lead" },
          { instanceId: "reviewer", instanceName: "Reviewer", teammateId: "reviewer", teammateName: "Reviewer" },
        ],
      },
      {
        teamId: "solo",
        teammates: [
          { instanceId: "solo", instanceName: "Solo", teammateId: "solo", teammateName: "Solo" },
        ],
      },
    ]);
  });
});
