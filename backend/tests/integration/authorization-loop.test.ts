import { describe, expect, it } from "vitest";

import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_PRIORITIES } from "../../../shared/protocol/domain.js";
import { createAuthorizationBridge } from "../../src/notifications/authorization-bridge.js";
import { createInMemoryNotificationRepository } from "../../src/notifications/notification-repository.js";
import { createNotificationService } from "../../src/notifications/notification-service.js";

describe("authorization loop", () => {
  it("keeps Claude Code waiting until a routed permission request is approved", async () => {
    const service = createNotificationService({
      notifications: createInMemoryNotificationRepository(),
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });
    const bridge = createAuthorizationBridge({ notifications: service });

    const request = bridge.createPermissionRequest({
      instanceId: "instance-id",
      title: "Allow command?",
      body: "Claude Code wants to run npm test",
    });
    service.route(request.notificationId, [{ deviceId: "phone", priority: 1, online: true }]);

    expect(request.status()).toBe("waiting");

    await bridge.resolve(request.notificationId, {
      deviceId: "phone",
      decision: "approved",
    });

    await expect(request.decision).resolves.toEqual({
      notificationId: request.notificationId,
      deviceId: "phone",
      decision: "approved",
    });
    expect(service.get(request.notificationId)).toMatchObject({
      type: NOTIFICATION_EVENT_TYPES.PERMISSION_REQUEST,
      priority: NOTIFICATION_PRIORITIES.URGENT,
      status: "read",
    });
  });
});
