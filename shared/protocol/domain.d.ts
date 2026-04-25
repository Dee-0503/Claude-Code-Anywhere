import type { ConnectionState } from "./messages.js";
export type ISODateTimeString = string;
export type DeviceId = string;
export type PairingCodeId = string;
export type ClaudeInstanceId = string;
export type ConnectionId = string;
export type InputMessageId = string;
export type NotificationEventId = string;
export declare const DEVICE_ROLES: {
    readonly ADMIN: "admin";
    readonly MEMBER: "member";
};
export type DeviceRole = (typeof DEVICE_ROLES)[keyof typeof DEVICE_ROLES];
export interface Device {
    id: DeviceId;
    name: string;
    role: DeviceRole;
    tokenHash: string;
    createdAt: ISODateTimeString;
    lastSeenAt: ISODateTimeString | null;
    revokedAt: ISODateTimeString | null;
}
export interface PairingCode {
    id: PairingCodeId;
    codeHash: string;
    createdByDeviceId: DeviceId | null;
    expiresAt: ISODateTimeString;
    usedAt: ISODateTimeString | null;
    usedByDeviceId: DeviceId | null;
}
export declare const CLAUDE_INSTANCE_STATUSES: {
    readonly IDLE: "idle";
    readonly RUNNING: "running";
    readonly EXITED: "exited";
    readonly ERROR: "error";
};
export type ClaudeInstanceStatus = (typeof CLAUDE_INSTANCE_STATUSES)[keyof typeof CLAUDE_INSTANCE_STATUSES];
export interface ClaudeInstance {
    id: ClaudeInstanceId;
    name: string;
    status: ClaudeInstanceStatus;
    ptyPid: number | null;
    cwd: string;
    createdByDeviceId: DeviceId;
    createdAt: ISODateTimeString;
    lastActiveAt: ISODateTimeString | null;
    exitedAt: ISODateTimeString | null;
}
export interface OutputChunk {
    instanceId: ClaudeInstanceId;
    offset: number;
    nextOffset: number;
    data: string;
    createdAt: ISODateTimeString;
}
export interface OutputBuffer {
    instanceId: ClaudeInstanceId;
    baseOffset: number;
    nextOffset: number;
    capacityBytes: number;
    chunks: OutputChunk[];
}
export declare const INPUT_MESSAGE_STATUSES: {
    readonly QUEUED: "queued";
    readonly INJECTED: "injected";
    readonly ACKED: "acked";
    readonly CANCELLED: "cancelled";
    readonly FAILED: "failed";
};
export type InputMessageStatus = (typeof INPUT_MESSAGE_STATUSES)[keyof typeof INPUT_MESSAGE_STATUSES];
export interface InputMessage {
    id: InputMessageId;
    instanceId: ClaudeInstanceId;
    deviceId: DeviceId;
    payload: string;
    status: InputMessageStatus;
    createdAt: ISODateTimeString;
    injectedAt: ISODateTimeString | null;
    ackedAt: ISODateTimeString | null;
}
export interface ClientConnection {
    id: ConnectionId;
    deviceId: DeviceId;
    instanceId: ClaudeInstanceId;
    state: ConnectionState;
    connectedAt: ISODateTimeString;
    lastSeenAt: ISODateTimeString;
    lastOutputOffset: number;
    disconnectedAt: ISODateTimeString | null;
}
export declare const NOTIFICATION_EVENT_TYPES: {
    readonly PERMISSION_REQUEST: "permission_request";
    readonly LONG_RUNNING_COMPLETE: "long_running_complete";
    readonly ERROR: "error";
    readonly MENTION: "mention";
    readonly INPUT_REQUIRED: "input_required";
};
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[keyof typeof NOTIFICATION_EVENT_TYPES];
export declare const NOTIFICATION_EVENT_STATUSES: {
    readonly PENDING: "pending";
    readonly DELIVERED: "delivered";
    readonly ESCALATED: "escalated";
    readonly READ: "read";
    readonly EXPIRED: "expired";
};
export type NotificationEventStatus = (typeof NOTIFICATION_EVENT_STATUSES)[keyof typeof NOTIFICATION_EVENT_STATUSES];
export interface NotificationEvent {
    id: NotificationEventId;
    instanceId: ClaudeInstanceId;
    deviceId: DeviceId | null;
    type: NotificationEventType;
    priority: NotificationPriority;
    status: NotificationEventStatus;
    title: string;
    body: string;
    createdAt: ISODateTimeString;
    deliveredAt: ISODateTimeString | null;
    readAt: ISODateTimeString | null;
    expiresAt: ISODateTimeString | null;
}
export declare const NOTIFICATION_PRIORITIES: {
    readonly LOW: "low";
    readonly NORMAL: "normal";
    readonly HIGH: "high";
    readonly URGENT: "urgent";
};
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[keyof typeof NOTIFICATION_PRIORITIES];
//# sourceMappingURL=domain.d.ts.map