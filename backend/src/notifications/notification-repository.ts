import type {
  DeviceId,
  NotificationEvent,
  NotificationEventId
} from '../../../shared/protocol/domain.js';
import { NOTIFICATION_EVENT_STATUSES } from '../../../shared/protocol/domain.js';
import type { SqliteDatabase } from '../db/connection.js';

export interface CreateNotificationInput {
  readonly id: NotificationEventId;
  readonly instanceId: string;
  readonly type: NotificationEvent['type'];
  readonly priority: NotificationEvent['priority'];
  readonly title: string;
  readonly body: string;
  readonly now: Date;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): NotificationEvent;
  get(id: NotificationEventId): NotificationEvent | undefined;
  listByInstance(instanceId: string): NotificationEvent[];
  markDelivered(
    id: NotificationEventId,
    deviceId: DeviceId,
    now: Date
  ): NotificationEvent | undefined;
  markRead(id: NotificationEventId, now: Date): NotificationEvent | undefined;
}

interface NotificationRow {
  id: string;
  instance_id: string;
  device_id: string | null;
  type: NotificationEvent['type'];
  priority: NotificationEvent['priority'];
  status: NotificationEvent['status'];
  title: string;
  body: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  expires_at: string | null;
}

function mapNotification(row: NotificationRow): NotificationEvent {
  return {
    id: row.id,
    instanceId: row.instance_id,
    deviceId: row.device_id,
    type: row.type,
    priority: row.priority,
    status: row.status,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    expiresAt: row.expires_at
  };
}

export function createSqliteNotificationRepository(
  database: SqliteDatabase
): NotificationRepository {
  const selectById = database.prepare('SELECT * FROM notifications WHERE id = ?');
  const selectByInstance = database.prepare(
    'SELECT * FROM notifications WHERE instance_id = ? ORDER BY created_at, id'
  );

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
        expiresAt: null
      };
      database
        .prepare(
          `
        INSERT INTO notifications (id, instance_id, device_id, type, priority, status, title, body, created_at, delivered_at, read_at, expires_at)
        VALUES (@id, @instanceId, @deviceId, @type, @priority, @status, @title, @body, @createdAt, @deliveredAt, @readAt, @expiresAt)
      `
        )
        .run(notification);
      return notification;
    },
    get(id) {
      const row = selectById.get(id) as NotificationRow | undefined;
      return row === undefined ? undefined : mapNotification(row);
    },
    listByInstance(instanceId) {
      return (selectByInstance.all(instanceId) as NotificationRow[]).map(mapNotification);
    },
    markDelivered(id, deviceId, now) {
      const existing = this.get(id);
      if (existing === undefined) return undefined;
      const updated: NotificationEvent = {
        ...existing,
        deviceId,
        status: NOTIFICATION_EVENT_STATUSES.DELIVERED,
        deliveredAt: now.toISOString()
      };
      database
        .prepare(
          'UPDATE notifications SET device_id = ?, status = ?, delivered_at = ? WHERE id = ?'
        )
        .run(updated.deviceId, updated.status, updated.deliveredAt, id);
      return updated;
    },
    markRead(id, now) {
      const existing = this.get(id);
      if (existing === undefined) return undefined;
      const updated: NotificationEvent = {
        ...existing,
        status: NOTIFICATION_EVENT_STATUSES.READ,
        readAt: now.toISOString()
      };
      database
        .prepare('UPDATE notifications SET status = ?, read_at = ? WHERE id = ?')
        .run(updated.status, updated.readAt, id);
      return updated;
    }
  };
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
        expiresAt: null
      };
      notifications.set(notification.id, notification);
      return notification;
    },
    get(id) {
      return notifications.get(id);
    },
    listByInstance(instanceId) {
      return [...notifications.values()].filter(
        (notification) => notification.instanceId === instanceId
      );
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
        deliveredAt: now.toISOString()
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
        readAt: now.toISOString()
      };
      notifications.set(id, updated);
      return updated;
    }
  };
}
