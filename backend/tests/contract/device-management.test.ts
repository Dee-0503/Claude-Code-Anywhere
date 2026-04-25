import { describe, expect, it } from "vitest";

import { DEVICE_ROLES, type Device } from "../../../shared/protocol/domain.js";
import { createDeviceApi } from "../../src/api/device-routes.js";
import { createAdminService } from "../../src/auth/admin-service.js";
import { createInMemoryDeviceRepository } from "../../src/auth/device-repository.js";
import { createBootstrapPairingService } from "../../src/auth/pairing-service.js";
import { generateToken, hashToken } from "../../src/auth/tokens.js";

const NOW = new Date("2026-04-25T12:00:00.000Z");

async function createDeviceFixture() {
  const devices = createInMemoryDeviceRepository();
  const adminToken = generateToken();
  const memberToken = generateToken();
  const admin: Device = {
    id: "admin-device",
    name: "Cee MacBook",
    role: DEVICE_ROLES.ADMIN,
    tokenHash: await hashToken(adminToken),
    createdAt: NOW.toISOString(),
    lastSeenAt: NOW.toISOString(),
    revokedAt: null,
  };
  const member: Device = {
    id: "member-device",
    name: "Cee iPhone",
    role: DEVICE_ROLES.MEMBER,
    tokenHash: await hashToken(memberToken),
    createdAt: NOW.toISOString(),
    lastSeenAt: NOW.toISOString(),
    revokedAt: null,
  };
  devices.create(admin);
  devices.create(member);
  const auth = createBootstrapPairingService({ devices, now: () => NOW });
  const api = createDeviceApi({
    admin: createAdminService({ auth, devices, now: () => NOW }),
  });

  return { api, auth, adminToken, memberToken };
}

describe("device management contract", () => {
  it("allows an admin to list and revoke paired devices", async () => {
    const { api, auth, adminToken, memberToken } = await createDeviceFixture();

    await expect(
      api.listDevices({
        device_id: "admin-device",
        access_token: adminToken,
      }),
    ).resolves.toEqual({
      devices: [
        expect.objectContaining({
          id: "admin-device",
          name: "Cee MacBook",
          role: DEVICE_ROLES.ADMIN,
          revoked_at: null,
        }),
        expect.objectContaining({
          id: "member-device",
          name: "Cee iPhone",
          role: DEVICE_ROLES.MEMBER,
          revoked_at: null,
        }),
      ],
    });

    await expect(
      api.revokeDevice({
        admin_device_id: "admin-device",
        access_token: adminToken,
        target_device_id: "member-device",
      }),
    ).resolves.toEqual({ revoked: true });
    await expect(
      auth.verifyDeviceToken({
        device_id: "member-device",
        access_token: memberToken,
      }),
    ).rejects.toMatchObject({ code: "DEVICE_REVOKED" });
  });

  it("transfers admin ownership and rejects later admin operations from the old admin", async () => {
    const { api, adminToken, memberToken } = await createDeviceFixture();

    await expect(
      api.transferAdmin({
        admin_device_id: "admin-device",
        access_token: adminToken,
        target_device_id: "member-device",
      }),
    ).resolves.toEqual({ new_admin_device_id: "member-device" });
    await expect(
      api.revokeDevice({
        admin_device_id: "admin-device",
        access_token: adminToken,
        target_device_id: "member-device",
      }),
    ).rejects.toMatchObject({ code: "ADMIN_REQUIRED" });
    await expect(
      api.revokeDevice({
        admin_device_id: "member-device",
        access_token: memberToken,
        target_device_id: "admin-device",
      }),
    ).resolves.toEqual({ revoked: true });
  });
});
