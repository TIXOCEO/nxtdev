/**
 * Sprint E — IBAN helpers.
 *
 * Pure utilities so they can be used both client-side (live form
 * validation) and server-side (authoritative check before write).
 *
 * - `normalizeIban`     strip spaces + uppercase
 * - `isValidIban`       length + char + mod-97 check
 * - `maskIban`          NL00 •••• •••• ••XX style
 * - `formatIbanGroups`  pretty 4-char groups, used in display
 */

const COUNTRY_LENGTH: Record<string, number> = {
  // Subset that we actually expect — extend as needed.
  NL: 18,
  BE: 16,
  DE: 22,
  FR: 27,
  GB: 22,
  ES: 24,
  IT: 27,
  LU: 20,
  AT: 20,
  PT: 25,
  IE: 22,
  PL: 28,
  DK: 18,
};

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function formatIbanGroups(value: string): string {
  const n = normalizeIban(value);
  return n.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Mask all but the last 2 characters of the local part. Country + check
 * digits stay visible (e.g. `NL12 •••• •••• ••34`).
 */
export function maskIban(value: string | null | undefined): string {
  if (!value) return "—";
  const n = normalizeIban(value);
  if (n.length < 6) return "•".repeat(n.length || 4);
  const head = n.slice(0, 4);
  const tail = n.slice(-2);
  const middleLen = Math.max(0, n.length - 4 - 2);
  const middle = "•".repeat(middleLen);
  return formatIbanGroups(`${head}${middle}${tail}`);
}

/**
 * IBAN mod-97 check. Implements the standard algorithm:
 *  1. Move first 4 chars to the end.
 *  2. Replace each letter with its 1-indexed alphabet position + 9
 *     (A=10, B=11, ... Z=35).
 *  3. Compute mod 97 — must equal 1.
 */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z0-9]+$/.test(iban)) return false;
  if (iban.length < 15 || iban.length > 34) return false;

  const country = iban.slice(0, 2);
  const expected = COUNTRY_LENGTH[country];
  if (expected !== undefined && iban.length !== expected) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    let n: number;
    if (code >= 48 && code <= 57) {
      n = code - 48;
    } else if (code >= 65 && code <= 90) {
      n = code - 65 + 10;
    } else {
      return false;
    }
    // Process digit-by-digit to avoid BigInt — safe in 32-bit float.
    // Letters expand to 2 digits (10..35), numbers stay 1 digit.
    const digits = String(n);
    for (const d of digits) {
      remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

export function ibanError(value: string): string | null {
  const n = normalizeIban(value);
  if (!n) return null; // empty is allowed (clearing the field)
  if (!isValidIban(n)) return "Ongeldig IBAN nummer.";
  return null;
}
