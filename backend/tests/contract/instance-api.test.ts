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
    })).resolves.toEqual({ instances: [], team_sessions: [] });

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

    const reviewer = await api.createInstance({
      device_id: device.device_id,
      access_token: device.access_token,
      name: "review",
      cwd: "/Users/ceemac/my_product/Claude Code Anywhere",
      team_metadata: {
        team_id: "team-1",
        teammate_id: "reviewer",
        teammate_name: "Reviewer",
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
        {
          id: reviewer.id,
          name: "review",
          status: CLAUDE_INSTANCE_STATUSES.RUNNING,
          last_active_at: "2026-04-25T12:00:00.000Z",
          team_metadata: {
            team_id: "team-1",
            teammate_id: "reviewer",
            teammate_name: "Reviewer",
          },
        },
      ],
      team_sessions: [
        {
          team_id: "team-1",
          teammates: [
            {
              instance_id: created.id,
              instance_name: "main",
              teammate_id: "lead",
              teammate_name: "Lead",
            },
            {
              instance_id: reviewer.id,
              instance_name: "review",
              teammate_id: "reviewer",
              teammate_name: "Reviewer",
            },
          ],
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

  it("hides instances from other authenticated devices", async () => {
    const auth = createBootstrapPairingService({
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });
    const adminPairing = await auth.createBootstrapPairingCode();
    const owner = await auth.consumePairingCode({
      pairing_code: adminPairing.pairing_code,
      device_name: "Owner browser",
    });
    const memberPairing = await auth.createPairingCode({
      device_id: owner.device_id,
      access_token: owner.access_token,
    });
    const other = await auth.consumePairingCode({
      pairing_code: memberPairing.pairing_code,
      device_name: "Other browser",
    });
    const { pty } = createKillTrackingPty();
    const api = createInstanceApi({
      auth,
      instances: createInstanceService({
        pty,
        now: () => new Date("2026-04-25T12:00:00.000Z"),
      }),
    });

    const owned = await api.createInstance({
      device_id: owner.device_id,
      access_token: owner.access_token,
      name: "owner-only",
      cwd: "/tmp",
    });

    await expect(api.listInstances({
      device_id: other.device_id,
      access_token: other.access_token,
    })).resolves.toEqual({ instances: [], team_sessions: [] });
    await expect(api.getInstanceStatus({
      device_id: other.device_id,
      access_token: other.access_token,
      instance_id: owned.id,
    })).rejects.toMatchObject({
      name: "ApiError",
      code: "INSTANCE_UNAVAILABLE",
      statusCode: 404,
    });
    await expect(api.stopInstance({
      device_id: other.device_id,
      access_token: other.access_token,
      instance_id: owned.id,
    })).rejects.toMatchObject({
      name: "ApiError",
      code: "INSTANCE_UNAVAILABLE",
      statusCode: 404,
    });
    await expect(api.getInstanceStatus({
      device_id: owner.device_id,
      access_token: owner.access_token,
      instance_id: owned.id,
    })).resolves.toEqual({
      id: owned.id,
      status: CLAUDE_INSTANCE_STATUSES.RUNNING,
    });
  }, 10_000);
  it("rejects instance cwd outside allowed workspace roots", async () => {
    expect(() => createInstanceService({
      allowedWorkspaceRoots: ["/path/that/does/not/exist"],
    }).startInstance({
      cwd: "/tmp",
      createdByDeviceId: "device-1",
    })).toThrow();

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
        allowedWorkspaceRoots: ["/tmp"],
        now: () => new Date("2026-04-25T12:00:00.000Z"),
      }),
    });

    await expect(api.createInstance({
      device_id: device.device_id,
      access_token: device.access_token,
      name: "escape",
      cwd: "/",
    })).rejects.toMatchObject({
      code: "INVALID_MESSAGE",
      statusCode: 400,
    });
  });

  it("enforces per-device and global active instance limits", async () => {
    const auth = createBootstrapPairingService({
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });
    const adminPairing = await auth.createBootstrapPairingCode();
    const owner = await auth.consumePairingCode({
      pairing_code: adminPairing.pairing_code,
      device_name: "Owner browser",
    });
    const memberPairing = await auth.createPairingCode({
      device_id: owner.device_id,
      access_token: owner.access_token,
    });
    const other = await auth.consumePairingCode({
      pairing_code: memberPairing.pairing_code,
      device_name: "Other browser",
    });
    const instances = createInstanceService({
      maxActiveInstancesPerDevice: 1,
      maxActiveInstancesGlobal: 2,
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });
    const api = createInstanceApi({ auth, instances });

    const first = await api.createInstance({
      device_id: owner.device_id,
      access_token: owner.access_token,
      name: "owner-1",
      cwd: "/tmp",
    });
    await expect(api.createInstance({
      device_id: owner.device_id,
      access_token: owner.access_token,
      name: "owner-2",
      cwd: "/tmp",
    })).rejects.toMatchObject({ code: "RATE_LIMITED" });

    await api.createInstance({
      device_id: other.device_id,
      access_token: other.access_token,
      name: "other-1",
      cwd: "/tmp",
    });
    await api.stopInstance({
      device_id: owner.device_id,
      access_token: owner.access_token,
      instance_id: first.id,
    });
    await expect(api.createInstance({
      device_id: owner.device_id,
      access_token: owner.access_token,
      name: "owner-3",
      cwd: "/tmp",
    })).resolves.toMatchObject({ name: "owner-3" });

    await expect(api.createInstance({
      device_id: owner.device_id,
      access_token: owner.access_token,
      name: "owner-4",
      cwd: "/tmp",
    })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  }, 10_000);

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
