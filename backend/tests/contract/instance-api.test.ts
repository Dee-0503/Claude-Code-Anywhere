import { describe, expect, it } from "vitest";

import { CLAUDE_INSTANCE_STATUSES } from "../../../shared/protocol/domain.js";
import { createInstanceApi } from "../../src/api/instance-routes.js";
import { createBootstrapPairingService } from "../../src/auth/pairing-service.js";
import type { PtyAdapter, PtyProcess } from "../../src/pty/pty-adapter.js";
import { createInstanceService } from "../../src/sessions/instance-service.js";

function createKillTrackingPty() {
  const killed: number[] = [];
  const pty: PtyAdapter = {
    spawn() {
      const process: PtyProcess = {
        pid: 42,
        write() { return; },
        resize() { return; },
        kill() { killed.push(process.pid); },
        onData() { return; },
        onExit() { return; },
      };
      return process;
    },
  };

  return { pty, killed };
}

describe("instance API contract", () => {
  it("lists, creates, reports status, and stops instances for authenticated devices", async () => {
    const auth = createBootstrapPairingService({
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });
    const pairing = await auth.createBootstrapPairingCode();
    const device = await auth.consumePairingCode({
      pairing_code: pairing.pairing_code,
      device_name: "Cee MacBook",
    });
    const { pty, killed } = createKillTrackingPty();
    const api = createInstanceApi({
      auth,
      instances: createInstanceService({
        pty,
        now: () => new Date("2026-04-25T12:00:00.000Z"),
      }),
    });

    await expect(api.listInstances({
      device_id: device.device_id,
      access_token: device.access_token,
    })).resolves.toEqual({ instances: [] });

    const created = await api.createInstance({
      device_id: device.device_id,
      access_token: device.access_token,
      name: "main",
      cwd: "/Users/ceemac/my_product/Claude Code Anywhere",
      team_metadata: {
        team_id: "team-1",
        teammate_id: "lead",
        teammate_name: "Lead",
      },
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      name: "main",
      status: CLAUDE_INSTANCE_STATUSES.RUNNING,
      team_metadata: {
        team_id: "team-1",
        teammate_id: "lead",
        teammate_name: "Lead",
      },
    });
    await expect(api.listInstances({
      device_id: device.device_id,
      access_token: device.access_token,
    })).resolves.toEqual({
      instances: [
        {
          id: created.id,
          name: "main",
          status: CLAUDE_INSTANCE_STATUSES.RUNNING,
          last_active_at: "2026-04-25T12:00:00.000Z",
          team_metadata: {
            team_id: "team-1",
            teammate_id: "lead",
            teammate_name: "Lead",
          },
        },
      ],
    });
    await expect(api.getInstanceStatus({
      device_id: device.device_id,
      access_token: device.access_token,
      instance_id: created.id,
    })).resolves.toEqual({
      id: created.id,
      status: CLAUDE_INSTANCE_STATUSES.RUNNING,
    });
    await expect(api.stopInstance({
      device_id: device.device_id,
      access_token: device.access_token,
      instance_id: created.id,
    })).resolves.toEqual({
      stopped: true,
      status: CLAUDE_INSTANCE_STATUSES.EXITED,
    });
    expect(killed).toEqual([42]);
  });

  it("returns typed not-found errors for unknown instances", async () => {
    const auth = createBootstrapPairingService({
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });
    const pairing = await auth.createBootstrapPairingCode();
    const device = await auth.consumePairingCode({
      pairing_code: pairing.pairing_code,
      device_name: "Cee MacBook",
    });
    const api = createInstanceApi({
      auth,
      instances: createInstanceService({
        now: () => new Date("2026-04-25T12:00:00.000Z"),
      }),
    });

    await expect(api.getInstanceStatus({
      device_id: device.device_id,
      access_token: device.access_token,
      instance_id: "missing-instance",
    })).rejects.toMatchObject({
      name: "ApiError",
      code: "INSTANCE_UNAVAILABLE",
      statusCode: 404,
    });
    await expect(api.stopInstance({
      device_id: device.device_id,
      access_token: device.access_token,
      instance_id: "missing-instance",
    })).rejects.toMatchObject({
      name: "ApiError",
      code: "INSTANCE_UNAVAILABLE",
      statusCode: 404,
    });
  });
});
