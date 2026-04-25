import { describe, expect, it } from "vitest";

import { DEVICE_ROLES } from "../../../shared/protocol/domain.js";
import { createInMemoryDeviceRepository } from "../../src/auth/device-repository.js";
import { createBootstrapPairingService } from "../../src/auth/pairing-service.js";
import { generateToken, hashToken } from "../../src/auth/tokens.js";
import { createRemoteTerminalSessionHarness } from "../../src/sessions/remote-terminal-session.js";

describe("multi-device instance management", () => {
  it("pairs a second device, switches between two instances, stops one, and rejects a revoked device", async () => {
    const devices = createInMemoryDeviceRepository();
    const adminToken = generateToken();
    const memberToken = generateToken();
    devices.create({
      id: "admin-device",
      name: "Cee MacBook",
      role: DEVICE_ROLES.ADMIN,
      tokenHash: await hashToken(adminToken),
      createdAt: "2026-04-25T12:00:00.000Z",
      lastSeenAt: "2026-04-25T12:00:00.000Z",
      revokedAt: null,
    });
    devices.create({
      id: "member-device",
      name: "Cee iPhone",
      role: DEVICE_ROLES.MEMBER,
      tokenHash: await hashToken(memberToken),
      createdAt: "2026-04-25T12:00:00.000Z",
      lastSeenAt: "2026-04-25T12:00:00.000Z",
      revokedAt: null,
    });
    const auth = createBootstrapPairingService({
      now: () => new Date("2026-04-25T12:00:00.000Z"),
      devices,
    });
    const harness = await createRemoteTerminalSessionHarness({
      auth,
      now: () => new Date("2026-04-25T12:00:00.000Z"),
      ptyScript: ["ready\n"],
    });

    const first = await harness.sessions.attachTerminal({
      device_id: "admin-device",
      access_token: adminToken,
      cwd: "/workspace/one",
      last_output_offset: 0,
    });
    const second = await harness.sessions.createInstance({
      device_id: "admin-device",
      access_token: adminToken,
      name: "second",
      cwd: "/workspace/two",
    });
    const switched = await harness.sessions.attachTerminal({
      device_id: "member-device",
      access_token: memberToken,
      instance_id: second.id,
      last_output_offset: 0,
    });

    expect(switched.firstMessage.instance_id).toBe(second.id);
    expect(harness.sessions.listInstances()).toEqual([
      expect.objectContaining({ id: first.firstMessage.instance_id, status: "running" }),
      expect.objectContaining({ id: second.id, name: "second", status: "running" }),
    ]);

    expect(await harness.sessions.stopInstance({
      device_id: "admin-device",
      access_token: adminToken,
      instance_id: second.id,
    })).toMatchObject({ id: second.id, status: "exited" });

    await harness.auth.revokeDevice({
      admin_device_id: "admin-device",
      access_token: adminToken,
      target_device_id: "member-device",
    });
    await expect(harness.sessions.attachTerminal({
      device_id: "member-device",
      access_token: memberToken,
      instance_id: first.firstMessage.instance_id,
      last_output_offset: 0,
    })).rejects.toMatchObject({ code: "DEVICE_REVOKED" });
  });
});
