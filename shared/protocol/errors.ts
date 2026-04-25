import type { ServerMessageType } from "./messages.js";

export const PROTOCOL_ERROR_CODES = {
  INVALID_MESSAGE: "INVALID_MESSAGE",
  INVALID_TOKEN: "INVALID_TOKEN",
  DEVICE_REVOKED: "DEVICE_REVOKED",
  INSTANCE_REQUIRED: "INSTANCE_REQUIRED",
  INSTANCE_UNAVAILABLE: "INSTANCE_UNAVAILABLE",
  OUTPUT_GAP: "OUTPUT_GAP",
  INPUT_REJECTED: "INPUT_REJECTED",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ProtocolErrorCode =
  (typeof PROTOCOL_ERROR_CODES)[keyof typeof PROTOCOL_ERROR_CODES];

export const PAIRING_ERROR_CODES = {
  PAIRING_REQUIRED: "PAIRING_REQUIRED",
  PAIRING_EXPIRED: "PAIRING_EXPIRED",
  PAIRING_USED: "PAIRING_USED",
  PAIRING_INVALID: "PAIRING_INVALID",
  ADMIN_REQUIRED: "ADMIN_REQUIRED",
} as const;

export type PairingErrorCode =
  (typeof PAIRING_ERROR_CODES)[keyof typeof PAIRING_ERROR_CODES];

export type ErrorCode = ProtocolErrorCode | PairingErrorCode;

export interface ProtocolError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ErrorMessagePayload extends ProtocolError {
  type: Extract<ServerMessageType, "error">;
}

export const RETRYABLE_ERROR_CODES = [
  PROTOCOL_ERROR_CODES.INSTANCE_UNAVAILABLE,
  PROTOCOL_ERROR_CODES.RATE_LIMITED,
  PROTOCOL_ERROR_CODES.INTERNAL_ERROR,
] as const satisfies readonly ErrorCode[];

export const FATAL_ERROR_CODES = [
  PROTOCOL_ERROR_CODES.INVALID_MESSAGE,
  PROTOCOL_ERROR_CODES.INVALID_TOKEN,
  PROTOCOL_ERROR_CODES.DEVICE_REVOKED,
  PROTOCOL_ERROR_CODES.INSTANCE_REQUIRED,
  PROTOCOL_ERROR_CODES.OUTPUT_GAP,
  PROTOCOL_ERROR_CODES.INPUT_REJECTED,
  PAIRING_ERROR_CODES.PAIRING_REQUIRED,
  PAIRING_ERROR_CODES.PAIRING_EXPIRED,
  PAIRING_ERROR_CODES.PAIRING_USED,
  PAIRING_ERROR_CODES.PAIRING_INVALID,
  PAIRING_ERROR_CODES.ADMIN_REQUIRED,
] as const satisfies readonly ErrorCode[];

export function isRetryableErrorCode(code: ErrorCode): boolean {
  return (RETRYABLE_ERROR_CODES as readonly ErrorCode[]).includes(code);
}
