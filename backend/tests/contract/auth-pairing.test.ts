import { describe, expect, it, vi } from "vitest";

import { DEVICE_ROLES } from "../../../shared/protocol/domain.js";
import { createInMemoryDeviceRepository } from "../../src/auth/device-repository.js";
import { createInMemoryPairingRepository } from "../../src/auth/pairing-repository.js";
import { createBootstrapPairingService } from "../../src/auth/pairing-service.js";
import { verifyToken } from "../../src/auth/tokens.js";

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

  it("rejects a raced pairing claim without keeping an issued device", async () => {
    const devices = createInMemoryDeviceRepository();
    const pairings = createInMemoryPairingRepository();
    const service = createBootstrapPairingService({
      now: () => NOW,
      pairingTtlMs: TEN_MINUTES_MS,
      devices,
      pairings,
    });
    const { pairing_code } = await service.createBootstrapPairingCode();
    const storedPairing = await pairings.findByCode(pairing_code);
    expect(storedPairing).toBeDefined();
    pairings.markUsed(storedPairing!.id, "other-device", NOW.toISOString());

    await expect(
      service.consumePairingCode({ pairing_code, device_name: "Raced browser" }),
    ).rejects.toMatchObject({ code: "PAIRING_CODE_ALREADY_USED" });
    expect(devices.list()).toEqual([]);
  });

  it("stores issued device tokens as password hashes instead of raw or SHA-256 digests", async () => {
    const devices = createInMemoryDeviceRepository();
    const service = createBootstrapPairingService({
      now: () => NOW,
      pairingTtlMs: TEN_MINUTES_MS,
      devices,
    });
    const { pairing_code } = await service.createBootstrapPairingCode();

    const pairedDevice = await service.consumePairingCode({
      pairing_code,
      device_name: "Cee iPhone",
    });
    const storedDevice = devices.getById(pairedDevice.device_id);

    expect(storedDevice?.tokenHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(storedDevice?.tokenHash).not.toBe(pairedDevice.access_token);
    expect(storedDevice?.tokenHash).not.toMatch(/^[a-f0-9]{64}$/);
    await expect(verifyToken(pairedDevice.access_token, storedDevice?.tokenHash ?? "")).resolves.toBe(true);
  });

  it("does not use Math.random when creating pairing codes", async () => {
    const mathRandomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not generate pairing codes");
    });
    const service = createService();

    try {
      await expect(service.createBootstrapPairingCode()).resolves.toMatchObject({
        pairing_code: expect.stringMatching(/^\d{3}-\d{3}$/),
      });
      expect(mathRandomSpy).not.toHaveBeenCalled();
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it("rejects expired pairing codes with the contract error code", async () => {
    let currentTime = NOW;
    const service = createBootstrapPairingService({
      now: () => currentTime,
      pairingTtlMs: TEN_MINUTES_MS,
    });
    const { pairing_code } = await service.createBootstrapPairingCode();
    currentTime = new Date(NOW.getTime() + TEN_MINUTES_MS + 1);

    await expect(
      service.consumePairingCode({ pairing_code, device_name: "Late browser" }),
    ).rejects.toMatchObject({ code: "PAIRING_CODE_EXPIRED" });
  });

  it("does not expose reusable plaintext pairing codes in storage", async () => {
    const pairings = createInMemoryPairingRepository();
    const service = createBootstrapPairingService({
      now: () => NOW,
      pairingTtlMs: TEN_MINUTES_MS,
      pairings,
    });

    const { pairing_code } = await service.createBootstrapPairingCode();
    const storedPairing = await pairings.findByCode(pairing_code);

    expect(storedPairing?.codeHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(storedPairing?.codeHash).not.toBe(pairing_code);
    expect(storedPairing?.codeHash).not.toMatch(/^[a-f0-9]{64}$/);
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
