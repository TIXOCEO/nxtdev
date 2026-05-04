import { z } from "zod";

/**
 * Strong password rules:
 *  - min 12 characters
 *  - at least one lowercase, one uppercase, one digit, one special character
 */
export const strongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(128, "Password is too long.")
  .refine((p) => /[a-z]/.test(p), "Must contain a lowercase letter.")
  .refine((p) => /[A-Z]/.test(p), "Must contain an uppercase letter.")
  .refine((p) => /\d/.test(p), "Must contain a digit.")
  .refine((p) => /[^A-Za-z0-9]/.test(p), "Must contain a special character.");

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** Colored token suitable for inline style. */
  color: string;
};

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Strong", "Very strong"];
const STRENGTH_COLORS = [
  "rgb(220 38 38)",   // red-600
  "rgb(234 88 12)",   // orange-600
  "rgb(202 138 4)",   // yellow-600
  "rgb(22 163 74)",   // green-600
  "rgb(5 150 105)",   // emerald-600
];

/**
 * Lightweight password-strength scorer (0-4). Mirrors the strong-password
 * schema rules and adds bonus credit for length and character variety.
 * Not a replacement for zxcvbn but no extra dep needed.
 */
export function scorePassword(p: string): PasswordStrength {
  if (!p) return { score: 0, label: STRENGTH_LABELS[0], color: STRENGTH_COLORS[0] };

  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;

  const variety =
    Number(/[a-z]/.test(p)) +
    Number(/[A-Z]/.test(p)) +
    Number(/\d/.test(p)) +
    Number(/[^A-Za-z0-9]/.test(p));

  if (variety >= 3) score++;
  if (variety === 4 && p.length >= 16) score++;

  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
  return {
    score: clamped,
    label: STRENGTH_LABELS[clamped],
    color: STRENGTH_COLORS[clamped],
  };
}

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SPECIAL = "!@#$%^&*-_=+?";
const ALL = LOWER + UPPER + DIGIT + SPECIAL;

/**
 * Generate a cryptographically random 16-character password that is
 * guaranteed to satisfy the strong-password schema.
 * Browser- and Node-safe via the `crypto` global available in both.
 */
export function generateStrongPassword(length = 16): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);

  // First 4 chars: one from each required class.
  const required = [
    LOWER[bytes[0] % LOWER.length],
    UPPER[bytes[1] % UPPER.length],
    DIGIT[bytes[2] % DIGIT.length],
    SPECIAL[bytes[3] % SPECIAL.length],
  ];

  // Remaining chars from the full alphabet.
  const rest: string[] = [];
  for (let i = 4; i < length; i++) {
    rest.push(ALL[bytes[i] % ALL.length]);
  }

  // Shuffle so required chars aren't always at the start.
  const all = [...required, ...rest];
  const shuffleBytes = new Uint32Array(all.length);
  crypto.getRandomValues(shuffleBytes);
  for (let i = all.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join("");
}
