import type { ReactElement } from "react";

export interface NotificationCenterItem {
  readonly id: string;
  readonly title: string;
  readonly priority: "low" | "normal" | "high" | "urgent";
  readonly status: "pending" | "delivered" | "read" | "escalated" | "expired";
}

export function renderNotificationCenter(notifications: readonly NotificationCenterItem[]): string {
  const unreadCount = notifications.filter((notification) => notification.status !== "read").length;
  if (unreadCount === 0) {
    return "没有未读通知。";
  }
  return `${unreadCount} 条未读通知等待处理。`;
}

export interface NotificationCenterProps {
  readonly notifications: readonly NotificationCenterItem[];
}

export function NotificationCenter({ notifications }: NotificationCenterProps): ReactElement {
  return (
    <section aria-label="通知中心">
      <p>{renderNotificationCenter(notifications)}</p>
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id} data-priority={notification.priority}>
            {notification.title}
          </li>
        ))}
      </ul>
    </section>
  );
}
