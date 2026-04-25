import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;
const HASH_ALGORITHM = "sha256";

export function generateToken(byteLength = TOKEN_BYTES): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error("Token byte length must be an integer >= 16");
  }

  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string): string {
  if (token.trim().length === 0) {
    throw new Error("Token must be non-empty");
  }

  return createHash(HASH_ALGORITHM).update(token, "utf8").digest("hex");
}

export function verifyToken(token: string, expectedHash: string): boolean {
  if (token.trim().length === 0 || expectedHash.trim().length === 0) {
    return false;
  }

  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
