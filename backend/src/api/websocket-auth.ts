import type { WebSocketConnectionParams } from "../../../shared/protocol/messages.js";
import { createApiError } from "./errors.js";
import { isNonEmptyString, isNonNegativeInteger } from "./validation.js";

export function validateWebSocketHandshake(params: Partial<WebSocketConnectionParams>): WebSocketConnectionParams {
  if (
    !isNonEmptyString(params.device_id) ||
    !isNonEmptyString(params.access_token) ||
    !isNonEmptyString(params.instance_id) ||
    !isNonNegativeInteger(params.last_output_offset)
  ) {
    throw createApiError("INVALID_WEBSOCKET_HANDSHAKE" as never, "Invalid WebSocket handshake");
  }

  return params as WebSocketConnectionParams;
}

export async function authenticateWebSocketConnection(
  params: Partial<WebSocketConnectionParams>,
  verifyDeviceToken?: (input: { device_id: string; access_token: string }) => Promise<unknown>,
): Promise<WebSocketConnectionParams> {
  const validParams = validateWebSocketHandshake(params);
  if (verifyDeviceToken !== undefined) {
    await verifyDeviceToken({
      device_id: validParams.device_id,
      access_token: validParams.access_token,
    });
  }
  return validParams;
}
