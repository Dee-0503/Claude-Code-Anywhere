export const DEVICE_ROLES = {
    ADMIN: "admin",
    MEMBER: "member",
};
export const CLAUDE_INSTANCE_STATUSES = {
    IDLE: "idle",
    RUNNING: "running",
    EXITED: "exited",
    ERROR: "error",
};
export const INPUT_MESSAGE_STATUSES = {
    QUEUED: "queued",
    INJECTED: "injected",
    ACKED: "acked",
    CANCELLED: "cancelled",
    FAILED: "failed",
};
export const NOTIFICATION_EVENT_TYPES = {
    PERMISSION_REQUEST: "permission_request",
    LONG_RUNNING_COMPLETE: "long_running_complete",
    ERROR: "error",
    MENTION: "mention",
    INPUT_REQUIRED: "input_required",
};
export const NOTIFICATION_EVENT_STATUSES = {
    PENDING: "pending",
    DELIVERED: "delivered",
    ESCALATED: "escalated",
    READ: "read",
    EXPIRED: "expired",
};
export const NOTIFICATION_PRIORITIES = {
    LOW: "low",
    NORMAL: "normal",
    HIGH: "high",
    URGENT: "urgent",
};
//# sourceMappingURL=domain.js.map