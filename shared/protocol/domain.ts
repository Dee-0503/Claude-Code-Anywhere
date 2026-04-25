import type { ConnectionState } from "./messages.js";

export type ISODateTimeString = string;
export type DeviceId = string;
export type PairingCodeId = string;
export type ClaudeInstanceId = string;
export type ConnectionId = string;
export type InputMessageId = string;
export type NotificationEventId = string;

export const DEVICE_ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
} as const;

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

export const CLAUDE_INSTANCE_STATUSES = {
  IDLE: "idle",
  RUNNING: "running",
  EXITED: "exited",
  ERROR: "error",
} as const;

export type ClaudeInstanceStatus =
  (typeof CLAUDE_INSTANCE_STATUSES)[keyof typeof CLAUDE_INSTANCE_STATUSES];

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

export const INPUT_MESSAGE_STATUSES = {
  QUEUED: "queued",
  INJECTED: "injected",
  ACKED: "acked",
  CANCELLED: "cancelled",
  FAILED: "failed",
} as const;

export type InputMessageStatus =
  (typeof INPUT_MESSAGE_STATUSES)[keyof typeof INPUT_MESSAGE_STATUSES];

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

export const NOTIFICATION_EVENT_TYPES = {
  PERMISSION_REQUEST: "permission_request",
  LONG_RUNNING_COMPLETE: "long_running_complete",
  ERROR: "error",
  MENTION: "mention",
  INPUT_REQUIRED: "input_required",
} as const;

export type NotificationEventType =
  (typeof NOTIFICATION_EVENT_TYPES)[keyof typeof NOTIFICATION_EVENT_TYPES];

export const NOTIFICATION_EVENT_STATUSES = {
  PENDING: "pending",
  DELIVERED: "delivered",
  ESCALATED: "escalated",
  READ: "read",
  EXPIRED: "expired",
} as const;

export type NotificationEventStatus =
  (typeof NOTIFICATION_EVENT_STATUSES)[keyof typeof NOTIFICATION_EVENT_STATUSES];

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

export const NOTIFICATION_PRIORITIES = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export type NotificationPriority =
  (typeof NOTIFICATION_PRIORITIES)[keyof typeof NOTIFICATION_PRIORITIES];
