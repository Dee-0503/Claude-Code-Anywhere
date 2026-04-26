import { CLAUDE_INSTANCE_STATUSES, type ClaudeInstance, type Device } from "../../../shared/protocol/domain.js";
import type { WebSocketConnectionParams } from "../../../shared/protocol/messages.js";
import { createApiError } from "./errors.js";
import { isNonEmptyString, isNonNegativeInteger } from "./validation.js";

export interface WebSocketRequestPolicyInput {
  readonly path: string;
  readonly origin?: string | null;
  readonly allowedPath?: string;
  readonly allowedOrigins?: readonly string[];
}

export interface WebSocketAuthenticationOptions {
  readonly verifyDeviceToken: (input: { device_id: string; access_token: string }) => Promise<Device & { device_id?: string }>;
  readonly findInstanceById: (instanceId: string) => ClaudeInstance | undefined;
  readonly findAttachableInstanceForDevice: (instanceId: string, deviceId: string) => ClaudeInstance | undefined;
}

function webSocketError(code: string, message: string, statusCode: number): Error & { code: string; statusCode: number } {
  return createApiError(code as never, message, { statusCode }) as Error & { code: string; statusCode: number };
}

export function rejectInvalidWebSocketRequestPolicy(input: WebSocketRequestPolicyInput): void {
  const allowedPath = input.allowedPath ?? "/ws";
  if (input.path !== allowedPath) {
    throw webSocketError("INVALID_WEBSOCKET_PATH", "Invalid WebSocket path", 400);
  }

  const allowedOrigins = input.allowedOrigins ?? [];
  if (allowedOrigins.length === 0) {
    if (isNonEmptyString(input.origin)) {
      throw webSocketError("WEBSOCKET_ORIGIN_DENIED", "WebSocket origin denied", 403);
    }
    return;
  }

  if (!isNonEmptyString(input.origin) || !allowedOrigins.includes(input.origin)) {
    throw webSocketError("WEBSOCKET_ORIGIN_DENIED", "WebSocket origin denied", 403);
  }
}

export function validateWebSocketHandshake(params: Partial<WebSocketConnectionParams>): WebSocketConnectionParams {
  if (!isNonEmptyString(params.device_id)) {
    throw webSocketError("INVALID_WEBSOCKET_HANDSHAKE", "device_id must be a non-empty string", 400);
  }

  if (params.access_token !== undefined && !isNonEmptyString(params.access_token)) {
    throw webSocketError("MISSING_WEBSOCKET_TOKEN", "WebSocket access token is required", 401);
  }

  if (!isNonEmptyString(params.instance_id)) {
    throw webSocketError("INVALID_WEBSOCKET_HANDSHAKE", "instance_id must be a non-empty string", 400);
  }

  if (!isNonNegativeInteger(params.last_output_offset)) {
    throw webSocketError("INVALID_WEBSOCKET_HANDSHAKE", "last_output_offset must be a non-negative integer", 400);
  }

  if (!isNonNegativeInteger(params.last_input_offset)) {
    throw webSocketError("INVALID_WEBSOCKET_HANDSHAKE", "last_input_offset must be a non-negative integer", 400);
  }

  if (!isNonEmptyString(params.access_token)) {
    throw webSocketError("MISSING_WEBSOCKET_TOKEN", "WebSocket access token is required", 401);
  }

  return params as WebSocketConnectionParams;
}

export async function authenticateWebSocketConnection(
  params: Partial<WebSocketConnectionParams>,
  options: WebSocketAuthenticationOptions,
): Promise<WebSocketConnectionParams> {
  const validParams = validateWebSocketHandshake(params);
  const device = await options.verifyDeviceToken({
    device_id: validParams.device_id,
    access_token: validParams.access_token,
  }).catch((error: unknown) => {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: unknown }).code === "INVALID_DEVICE_TOKEN"
    ) {
      throw webSocketError("INVALID_DEVICE_TOKEN", "Invalid device token", 401);
    }
    throw error;
  });
  const deviceId = "device_id" in device && device.device_id !== undefined
    ? device.device_id
    : device.id;

  const instance = options.findInstanceById(validParams.instance_id);
  if (instance === undefined) {
    throw webSocketError("WEBSOCKET_INSTANCE_NOT_FOUND", "WebSocket instance not found", 404);
  }

  const attachableInstance = options.findAttachableInstanceForDevice(validParams.instance_id, deviceId);
  if (attachableInstance === undefined) {
    throw webSocketError("WEBSOCKET_INSTANCE_FORBIDDEN", "WebSocket instance access denied", 403);
  }

  if (attachableInstance.status !== CLAUDE_INSTANCE_STATUSES.RUNNING && attachableInstance.status !== CLAUDE_INSTANCE_STATUSES.IDLE) {
    throw webSocketError("WEBSOCKET_INSTANCE_NOT_ATTACHABLE", "WebSocket instance is not attachable", 404);
  }

  return validParams;
}
