import { once } from "node:events";
import type { Server } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { CLAUDE_INSTANCE_STATUSES } from "../../../shared/protocol/domain.js";
import { createWebSocketServerBootstrap } from "../../src/api/websocket-server.js";
import { createBootstrapPairingService } from "../../src/auth/pairing-service.js";
import { createInMemoryInstanceRepository } from "../../src/sessions/instance-repository.js";
import { createInstanceService } from "../../src/sessions/instance-service.js";

const NOW = new Date("2026-04-25T12:00:00.000Z");
const TEN_MINUTES_MS = 10 * 60 * 1000;

async function createFixture() {
  const service = createBootstrapPairingService({
    now: () => NOW,
    pairingTtlMs: TEN_MINUTES_MS,
  });
  const instances = createInstanceService({
    repository: createInMemoryInstanceRepository(),
    now: () => NOW,
  });
  const bootstrap = await service.createBootstrapPairingCode();
  const admin = await service.consumePairingCode({
    pairing_code: bootstrap.pairing_code,
    device_name: "Admin browser",
  });
  const pairing = await service.createPairingCode({
    device_id: admin.device_id,
    access_token: admin.access_token,
    target_name_hint: "Member browser",
  });
  const member = await service.consumePairingCode({
    pairing_code: pairing.pairing_code,
    device_name: "Member browser",
  });
  const { instance } = instances.startInstance({
    cwd: "/workspace",
    createdByDeviceId: admin.device_id,
  });

  const bootstrapServer = createWebSocketServerBootstrap({
    host: "127.0.0.1",
    port: 0,
    databasePath: ":memory:",
    repositoryMode: "memory",
    tlsMode: "off",
    trustReverseProxy: false,
    outputBufferBytes: 1024 * 1024,
    heartbeatIntervalMs: 15_000,
    heartbeatTimeoutMs: 45_000,
    websocketPath: "/ws",
    websocketAllowedOrigins: ["https://console.example.com"],
  }, undefined, {
    verifyDeviceToken: service.verifyDeviceToken,
    findInstanceById: instances.getInstance,
    findAttachableInstanceForDevice: (instanceId, deviceId) => instances.getInstanceForDevice(instanceId, deviceId),
  });

  return { service, instances, admin, member, instance, bootstrapServer };
}

function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  return once(server, "listening").then(() => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected TCP server address");
    }
    return address.port;
  });
}

function connectWebSocket(url: string, origin = "https://console.example.com"): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function rejectUpgrade(url: string, origin = "https://console.example.com"): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    socket.once("open", () => reject(new Error("Expected WebSocket upgrade rejection")));
    socket.once("unexpected-response", (_request, response) => {
      socket.close();
      resolve(response.statusCode ?? 0);
    });
    socket.once("error", reject);
  });
}

describe("websocket HTTP upgrade authentication", () => {
  let server: Server | undefined;

  beforeEach(() => {
    server = undefined;
  });

  afterEach(async () => {
    if (server !== undefined && server.listening) {
      server.close();
      await once(server, "close");
    }
  });

  it("rejects missing and invalid tokens before handleUpgrade", async () => {
    const { admin, instance, bootstrapServer } = await createFixture();
    server = bootstrapServer.httpServer;
    const port = await listen(server);

    await expect(rejectUpgrade(`ws://127.0.0.1:${port}/ws?device_id=${admin.device_id}&instance_id=${instance.id}&last_output_offset=0`)).resolves.toBe(400);
    await expect(rejectUpgrade(`ws://127.0.0.1:${port}/ws?device_id=${admin.device_id}&access_token=tampered-token&instance_id=${instance.id}&last_output_offset=0`)).resolves.toBe(401);
    expect(bootstrapServer.registry.list()).toHaveLength(0);
  });

  it("rejects unauthorized, missing, and non-attachable instances before handleUpgrade", async () => {
    const { admin, member, instance, instances, bootstrapServer } = await createFixture();
    server = bootstrapServer.httpServer;
    const port = await listen(server);

    await expect(rejectUpgrade(`ws://127.0.0.1:${port}/ws?device_id=${member.device_id}&access_token=${member.access_token}&instance_id=${instance.id}&last_output_offset=0`)).resolves.toBe(403);
    await expect(rejectUpgrade(`ws://127.0.0.1:${port}/ws?device_id=${admin.device_id}&access_token=${admin.access_token}&instance_id=missing-instance&last_output_offset=0`)).resolves.toBe(404);

    instances.repository.update({
      ...instance,
      status: CLAUDE_INSTANCE_STATUSES.EXITED,
      exitedAt: NOW.toISOString(),
    });
    await expect(rejectUpgrade(`ws://127.0.0.1:${port}/ws?device_id=${admin.device_id}&access_token=${admin.access_token}&instance_id=${instance.id}&last_output_offset=0`)).resolves.toBe(404);
    expect(bootstrapServer.registry.list()).toHaveLength(0);
  });

  it("rejects invalid origin and path and accepts authorized upgrades", async () => {
    const { admin, instance, bootstrapServer } = await createFixture();
    server = bootstrapServer.httpServer;
    const port = await listen(server);
    const validUrl = `ws://127.0.0.1:${port}/ws?device_id=${admin.device_id}&access_token=${admin.access_token}&instance_id=${instance.id}&last_output_offset=0`;

    await expect(rejectUpgrade(validUrl, "https://evil.example.com")).resolves.toBe(403);
    await expect(rejectUpgrade(`ws://127.0.0.1:${port}/not-ws?device_id=${admin.device_id}&access_token=${admin.access_token}&instance_id=${instance.id}&last_output_offset=0`)).resolves.toBe(400);

    const socket = await connectWebSocket(validUrl);
    expect(bootstrapServer.registry.list()).toHaveLength(1);
    socket.close(1000, "client done");
    await once(socket, "close");
  });
});
