import { randomUUID } from "node:crypto";

import type { DeviceId, NotificationEvent, NotificationEventId } from "../../../shared/protocol/domain.js";
import { NOTIFICATION_EVENT_STATUSES } from "../../../shared/protocol/domain.js";
import { createInMemoryNotificationRepository, type NotificationRepository } from "./notification-repository.js";

export interface NotificationServiceOptions {
  readonly notifications?: NotificationRepository;
  readonly now?: () => Date;
}

export interface EmitNotificationInput {
  readonly instanceId: string;
  readonly type: NotificationEvent["type"];
  readonly priority: NotificationEvent["priority"];
  readonly title: string;
  readonly body: string;
}

export interface NotificationRouteTarget {
  readonly deviceId: DeviceId;
  readonly priority: number;
  readonly online: boolean;
}

export interface NotificationDelivery {
  readonly notificationId: NotificationEventId;
  readonly deviceId: DeviceId;
  readonly status: "delivered";
}

export function createNotificationService(options: NotificationServiceOptions = {}) {
  const notifications = options.notifications ?? createInMemoryNotificationRepository();
  const now = options.now ?? (() => new Date());

  function emit(input: EmitNotificationInput): NotificationEvent {
    return notifications.create({
      id: randomUUID(),
      instanceId: input.instanceId,
      type: input.type,
      priority: input.priority,
      title: input.title,
      body: input.body,
      now: now(),
    });
  }

  function route(notificationId: NotificationEventId, targets: readonly NotificationRouteTarget[]): NotificationDelivery | undefined {
    const target = targets
      .filter((candidate) => candidate.online)
      .sort((left, right) => left.priority - right.priority)[0];
    if (target === undefined) {
      return undefined;
    }

    notifications.markDelivered(notificationId, target.deviceId, now());
    return { notificationId, deviceId: target.deviceId, status: "delivered" };
  }

  function markRead(notificationId: NotificationEventId): void {
    notifications.markRead(notificationId, now());
  }

  function listPending(instanceId: string): NotificationEvent[] {
    return notifications
      .listByInstance(instanceId)
      .filter((notification) => notification.status !== NOTIFICATION_EVENT_STATUSES.READ);
  }

  function get(notificationId: NotificationEventId): NotificationEvent | undefined {
    return notifications.get(notificationId);
  }

  return { emit, route, markRead, listPending, get };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
