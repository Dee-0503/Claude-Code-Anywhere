import {
  type ErrorCode,
  type ErrorMessagePayload,
  isRetryableErrorCode,
  PROTOCOL_ERROR_CODES,
} from "../../../shared/protocol/errors.js";
import { SERVER_MESSAGE_TYPES } from "../../../shared/protocol/messages.js";

interface ApiErrorOptions {
  readonly statusCode?: number;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: ApiErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    this.retryable = options.retryable ?? isRetryableErrorCode(code);

    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}

export function createApiError(
  code: ErrorCode,
  message: string,
  options: ApiErrorOptions = {},
): ApiError {
  return new ApiError(code, message, options);
}

export function invalidRequest(
  message: string,
  details?: Record<string, unknown>,
): ApiError {
  return new ApiError(PROTOCOL_ERROR_CODES.INVALID_MESSAGE, message, {
    statusCode: 400,
    ...(details === undefined ? {} : { details }),
  });
}

export function internalError(cause?: unknown): ApiError {
  return new ApiError(
    PROTOCOL_ERROR_CODES.INTERNAL_ERROR,
    "Internal server error",
    {
      statusCode: 500,
      cause,
    },
  );
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return internalError(error);
  }

  return internalError();
}

export function toErrorPayload(error: ApiError): ErrorMessagePayload {
  return {
    type: SERVER_MESSAGE_TYPES.ERROR,
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    ...(error.details === undefined ? {} : { details: error.details }),
  };
}
