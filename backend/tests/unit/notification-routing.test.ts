import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PRIORITIES
} from '../../../shared/protocol/domain.js';
import { createInMemoryNotificationRepository } from '../../src/notifications/notification-repository.js';
import { createNotificationService } from '../../src/notifications/notification-service.js';

describe('notification priority routing', () => {
  it('delivers permission requests to the highest priority online device first', () => {
    const service = createNotificationService({
      notifications: createInMemoryNotificationRepository(),
      now: () => new Date('2026-04-25T12:00:00.000Z')
    });

    const notification = service.emit({
      instanceId: 'instance-id',
      type: NOTIFICATION_EVENT_TYPES.PERMISSION_REQUEST,
      priority: NOTIFICATION_PRIORITIES.URGENT,
      title: 'Permission required',
      body: 'Claude Code needs approval'
    });
    const delivery = service.route(notification.id, [
      { deviceId: 'phone', priority: 2, online: true },
      { deviceId: 'desktop', priority: 1, online: true }
    ]);

    expect(delivery).toMatchObject({
      notificationId: notification.id,
      deviceId: 'desktop',
      status: 'delivered'
    });
    expect(service.listPending('instance-id')).toEqual([
      expect.objectContaining({
        id: notification.id,
        deviceId: 'desktop',
        status: 'delivered'
      })
    ]);
  });

  it('marks matching pending notifications read when one device acknowledges it', () => {
    const service = createNotificationService({
      notifications: createInMemoryNotificationRepository(),
      now: () => new Date('2026-04-25T12:00:00.000Z')
    });
    const notification = service.emit({
      instanceId: 'instance-id',
      type: NOTIFICATION_EVENT_TYPES.INPUT_REQUIRED,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      title: 'Input required',
      body: 'Claude Code is waiting for input'
    });
    service.route(notification.id, [
      { deviceId: 'desktop', priority: 1, online: true },
      { deviceId: 'phone', priority: 2, online: true }
    ]);

    service.markRead(notification.id);

    expect(service.listPending('instance-id')).toEqual([]);
    expect(service.get(notification.id)).toMatchObject({
      status: 'read',
      readAt: '2026-04-25T12:00:00.000Z'
    });
  });
});
