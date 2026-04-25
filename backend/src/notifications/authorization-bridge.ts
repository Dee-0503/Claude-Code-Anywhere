import type { DeviceId, NotificationEventId } from "../../../shared/protocol/domain.js";
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_PRIORITIES } from "../../../shared/protocol/domain.js";
import type { NotificationService } from "./notification-service.js";

export type AuthorizationDecision = "approved" | "rejected";

export interface AuthorizationRequestInput {
  readonly instanceId: string;
  readonly title: string;
  readonly body: string;
}

export interface ResolveAuthorizationInput {
  readonly deviceId: DeviceId;
  readonly decision: AuthorizationDecision;
}

export interface AuthorizationDecisionResult extends ResolveAuthorizationInput {
  readonly notificationId: NotificationEventId;
}

export interface AuthorizationBridgeOptions {
  readonly notifications: NotificationService;
}

export function createAuthorizationBridge(options: AuthorizationBridgeOptions) {
  const pending = new Map<NotificationEventId, {
    readonly decision: Promise<AuthorizationDecisionResult>;
    readonly resolve: (decision: AuthorizationDecisionResult) => void;
    resolved: boolean;
  }>();

  function createPermissionRequest(input: AuthorizationRequestInput) {
    const notification = options.notifications.emit({
      instanceId: input.instanceId,
      type: NOTIFICATION_EVENT_TYPES.PERMISSION_REQUEST,
      priority: NOTIFICATION_PRIORITIES.URGENT,
      title: input.title,
      body: input.body,
    });
    let resolver: (decision: AuthorizationDecisionResult) => void = () => undefined;
    const decision = new Promise<AuthorizationDecisionResult>((resolve) => {
      resolver = resolve;
    });
    pending.set(notification.id, { decision, resolve: resolver, resolved: false });

    return {
      notificationId: notification.id,
      decision,
      status: () => pending.get(notification.id)?.resolved === true ? "resolved" : "waiting",
    };
  }

  async function resolve(notificationId: NotificationEventId, input: ResolveAuthorizationInput): Promise<void> {
    const request = pending.get(notificationId);
    if (request === undefined || request.resolved) {
      return;
    }
    request.resolved = true;
    options.notifications.markRead(notificationId);
    request.resolve({ notificationId, deviceId: input.deviceId, decision: input.decision });
  }

  return { createPermissionRequest, resolve };
}
