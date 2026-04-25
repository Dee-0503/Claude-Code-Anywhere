import { describe, expect, it } from "vitest";

import { DEVICE_ROLES } from "../../../shared/protocol/domain.js";
import { createBootstrapPairingService } from "../../src/auth/pairing-service.js";

const NOW = new Date("2026-04-25T12:00:00.000Z");
const TEN_MINUTES_MS = 10 * 60 * 1000;

function createService() {
  return createBootstrapPairingService({
    now: () => NOW,
    pairingTtlMs: TEN_MINUTES_MS,
  });
}

describe("auth pairing contract", () => {
  it("creates a short-lived bootstrap pairing code when no admin device exists", async () => {
    const service = createService();

    const pairing = await service.createBootstrapPairingCode();

    expect(pairing).toEqual({
      pairing_code: expect.stringMatching(/^\d{3}-\d{3}$/),
      expires_at: "2026-04-25T12:10:00.000Z",
    });
    await expect(service.createBootstrapPairingCode()).rejects.toMatchObject({
      code: "BOOTSTRAP_PAIRING_ALREADY_ACTIVE",
    });
  });

  it("consumes the first valid bootstrap code exactly once and returns an admin device token", async () => {
    const service = createService();
    const { pairing_code } = await service.createBootstrapPairingCode();

    const pairedDevice = await service.consumePairingCode({
      pairing_code,
      device_name: "Cee iPhone",
    });

    expect(pairedDevice).toEqual({
      device_id: expect.any(String),
      access_token: expect.stringMatching(/^[A-Za-z0-9_-]{32,}$/),
      role: DEVICE_ROLES.ADMIN,
    });
    await expect(
      service.consumePairingCode({ pairing_code, device_name: "Replay" }),
    ).rejects.toMatchObject({ code: "PAIRING_CODE_ALREADY_USED" });
  });

  it("allows an admin token to create member pairing codes and rejects invalid tokens", async () => {
    const service = createService();
    const bootstrap = await service.createBootstrapPairingCode();
    const admin = await service.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: "Admin browser",
    });

    const memberPairing = await service.createPairingCode({
      device_id: admin.device_id,
      access_token: admin.access_token,
      target_name_hint: "Cee iPhone",
    });

    expect(memberPairing).toEqual({
      pairing_code: expect.stringMatching(/^\d{3}-\d{3}$/),
      expires_at: "2026-04-25T12:10:00.000Z",
    });
    await expect(
      service.createPairingCode({
        device_id: admin.device_id,
        access_token: "wrong-token",
        target_name_hint: "Mallory",
      }),
    ).rejects.toMatchObject({ code: "INVALID_DEVICE_TOKEN" });
  });

  it("verifies issued device tokens and rejects revoked devices", async () => {
    const service = createService();
    const bootstrap = await service.createBootstrapPairingCode();
    const admin = await service.consumePairingCode({
      pairing_code: bootstrap.pairing_code,
      device_name: "Admin browser",
    });

    await expect(
      service.verifyDeviceToken({
        device_id: admin.device_id,
        access_token: admin.access_token,
      }),
    ).resolves.toMatchObject({
      device_id: admin.device_id,
      role: DEVICE_ROLES.ADMIN,
    });

    await service.revokeDevice({
      admin_device_id: admin.device_id,
      access_token: admin.access_token,
      target_device_id: admin.device_id,
    });

    await expect(
      service.verifyDeviceToken({
        device_id: admin.device_id,
        access_token: admin.access_token,
      }),
    ).rejects.toMatchObject({ code: "DEVICE_REVOKED" });
  });
});
