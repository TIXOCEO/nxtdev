import "server-only";
import { randomBytes } from "node:crypto";

/**
 * URL-safe, cryptographically random invite token.
 * Default: 32 bytes → 43 base64url chars (~256 bits of entropy).
 */
export function generateInviteToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}
