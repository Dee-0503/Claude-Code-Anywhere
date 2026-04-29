import { randomBytes } from 'node:crypto';

import { compare, hash } from 'bcryptjs';

const TOKEN_BYTES = 32;
const BCRYPT_COST = 12;

export function generateToken(byteLength = TOKEN_BYTES): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error('Token byte length must be an integer >= 16');
  }

  return randomBytes(byteLength).toString('base64url');
}

export async function hashToken(token: string): Promise<string> {
  if (token.trim().length === 0) {
    throw new Error('Token must be non-empty');
  }

  return hash(token, BCRYPT_COST);
}

export async function verifyToken(token: string, expectedHash: string): Promise<boolean> {
  if (token.trim().length === 0 || expectedHash.trim().length === 0) {
    return false;
  }

  return compare(token, expectedHash);
}
