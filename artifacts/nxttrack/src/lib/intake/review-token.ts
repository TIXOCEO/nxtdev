import { createHash, randomBytes } from "node:crypto";

const REVIEW_TOKEN_TTL_DAYS = 7;

export interface GeneratedReviewToken {
  plain: string;
  hash: string;
  expiresAt: string;
}

export function generateReviewToken(): GeneratedReviewToken {
  const plain = randomBytes(32).toString("hex");
  const hash = hashReviewToken(plain);
  const expiresAt = new Date(
    Date.now() + REVIEW_TOKEN_TTL_DAYS * 24 * 3600 * 1000,
  ).toISOString();
  return { plain, hash, expiresAt };
}

export function hashReviewToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}
