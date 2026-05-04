import "server-only";
import { randomInt } from "node:crypto";

/**
 * Short human-readable invite/link code, unambiguous (no 0/O/1/I).
 *
 * Example output: "K7P-9F4M".
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  const pick = () => ALPHABET[randomInt(0, ALPHABET.length)];
  const left = Array.from({ length: 3 }, pick).join("");
  const right = Array.from({ length: 4 }, pick).join("");
  return `${left}-${right}`;
}
