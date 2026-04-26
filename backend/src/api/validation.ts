import { invalidRequest } from './errors.js';

export type Validator<T> = (value: unknown) => value is T;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function requireRecord(
  value: unknown,
  message = 'Request body must be an object'
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidRequest(message);
  }

  return value;
}

export function requireStringField(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  if (!isNonEmptyString(value)) {
    throw invalidRequest(`${field} must be a non-empty string`, { field });
  }

  return value;
}

export function requireNonNegativeIntegerField(
  source: Record<string, unknown>,
  field: string
): number {
  const value = source[field];
  if (!isNonNegativeInteger(value)) {
    throw invalidRequest(`${field} must be a non-negative integer`, { field });
  }

  return value;
}

export function optionalStringField(
  source: Record<string, unknown>,
  field: string
): string | undefined {
  const value = source[field];
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isNonEmptyString(value)) {
    throw invalidRequest(`${field} must be a non-empty string`, { field });
  }

  return value;
}

export function requireEnumField<T extends string>(
  source: Record<string, unknown>,
  field: string,
  allowedValues: readonly T[]
): T {
  const value = source[field];
  if (typeof value !== 'string' || !allowedValues.includes(value as T)) {
    throw invalidRequest(`${field} must be one of: ${allowedValues.join(', ')}`, {
      field,
      allowedValues
    });
  }

  return value as T;
}

export function validateRequest<T>(
  value: unknown,
  validator: Validator<T>,
  message = 'Invalid request'
): T {
  if (!validator(value)) {
    throw invalidRequest(message);
  }

  return value;
}

export function parseJsonObject(input: string): Record<string, unknown> {
  try {
    return requireRecord(JSON.parse(input));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw invalidRequest('Request body must be valid JSON');
    }

    throw error;
  }
}
