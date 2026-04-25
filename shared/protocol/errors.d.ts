import type { ServerMessageType } from "./messages.js";
export declare const PROTOCOL_ERROR_CODES: {
    readonly INVALID_MESSAGE: "INVALID_MESSAGE";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly DEVICE_REVOKED: "DEVICE_REVOKED";
    readonly INSTANCE_REQUIRED: "INSTANCE_REQUIRED";
    readonly INSTANCE_UNAVAILABLE: "INSTANCE_UNAVAILABLE";
    readonly OUTPUT_GAP: "OUTPUT_GAP";
    readonly INPUT_REJECTED: "INPUT_REJECTED";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[keyof typeof PROTOCOL_ERROR_CODES];
export declare const PAIRING_ERROR_CODES: {
    readonly PAIRING_REQUIRED: "PAIRING_REQUIRED";
    readonly PAIRING_EXPIRED: "PAIRING_EXPIRED";
    readonly PAIRING_USED: "PAIRING_USED";
    readonly PAIRING_INVALID: "PAIRING_INVALID";
    readonly ADMIN_REQUIRED: "ADMIN_REQUIRED";
};
export type PairingErrorCode = (typeof PAIRING_ERROR_CODES)[keyof typeof PAIRING_ERROR_CODES];
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
export declare const RETRYABLE_ERROR_CODES: readonly ["INSTANCE_UNAVAILABLE", "RATE_LIMITED", "INTERNAL_ERROR"];
export declare const FATAL_ERROR_CODES: readonly ["INVALID_MESSAGE", "INVALID_TOKEN", "DEVICE_REVOKED", "INSTANCE_REQUIRED", "OUTPUT_GAP", "INPUT_REJECTED", "PAIRING_REQUIRED", "PAIRING_EXPIRED", "PAIRING_USED", "PAIRING_INVALID", "ADMIN_REQUIRED"];
export declare function isRetryableErrorCode(code: ErrorCode): boolean;
//# sourceMappingURL=errors.d.ts.map