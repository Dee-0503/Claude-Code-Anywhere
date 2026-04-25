import type { DeviceId, NotificationEvent, NotificationEventId } from "../../../shared/protocol/domain.js";
import { NOTIFICATION_EVENT_STATUSES } from "../../../shared/protocol/domain.js";

export interface CreateNotificationInput {
  readonly id: NotificationEventId;
  readonly instanceId: string;
  readonly type: NotificationEvent["type"];
  readonly priority: NotificationEvent["priority"];
  readonly title: string;
  readonly body: string;
  readonly now: Date;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): NotificationEvent;
  get(id: NotificationEventId): NotificationEvent | undefined;
  listByInstance(instanceId: string): NotificationEvent[];
  markDelivered(id: NotificationEventId, deviceId: DeviceId, now: Date): NotificationEvent | undefined;
  markRead(id: NotificationEventId, now: Date): NotificationEvent | undefined;
}

export function createInMemoryNotificationRepository(): NotificationRepository {
  const notifications = new Map<NotificationEventId, NotificationEvent>();

  return {
    create(input) {
      const notification: NotificationEvent = {
        id: input.id,
        instanceId: input.instanceId,
        deviceId: null,
        type: input.type,
        priority: input.priority,
        status: NOTIFICATION_EVENT_STATUSES.PENDING,
        title: input.title,
        body: input.body,
        createdAt: input.now.toISOString(),
        deliveredAt: null,
        readAt: null,
        expiresAt: null,
      };
      notifications.set(notification.id, notification);
      return notification;
    },
    get(id) {
      return notifications.get(id);
    },
    listByInstance(instanceId) {
      return [...notifications.values()].filter((notification) => notification.instanceId === instanceId);
    },
    markDelivered(id, deviceId, now) {
      const existing = notifications.get(id);
      if (existing === undefined) {
        return undefined;
      }
      const updated: NotificationEvent = {
        ...existing,
        deviceId,
        status: NOTIFICATION_EVENT_STATUSES.DELIVERED,
        deliveredAt: now.toISOString(),
      };
      notifications.set(id, updated);
      return updated;
    },
    markRead(id, now) {
      const existing = notifications.get(id);
      if (existing === undefined) {
        return undefined;
      }
      const updated: NotificationEvent = {
        ...existing,
        status: NOTIFICATION_EVENT_STATUSES.READ,
        readAt: now.toISOString(),
      };
      notifications.set(id, updated);
      return updated;
    },
  };
}
