/**
 * Sprint 75 — Bucketing-heuristiek voor publieke wachtrij-indicator.
 *
 * Pure functie: geen I/O, geen tijd-afhankelijkheid. Veilig in
 * server-componenten én in unit tests.
 *
 * Regels (van streng naar mild):
 *   1. available <= 0  OF  waiting >= high  → 'long'
 *   2. waiting >= low                       → 'medium'
 *   3. anders                                → 'short'
 *
 * Defaults worden gebruikt wanneer een tenant per-programma geen
 * thresholds heeft ingesteld.
 */

export type WaitlistBucket = "short" | "medium" | "long";

export const DEFAULT_WAITLIST_THRESHOLD_LOW = 5;
export const DEFAULT_WAITLIST_THRESHOLD_HIGH = 15;

export interface BucketWaitlistInput {
  waitingCount: number;
  availableSeats: number;
  thresholdLow?: number | null;
  thresholdHigh?: number | null;
}

export function bucketWaitlistPressure(input: BucketWaitlistInput): WaitlistBucket {
  const waiting = Math.max(0, Math.floor(input.waitingCount));
  const available = Math.max(0, Math.floor(input.availableSeats));

  const lowRaw = input.thresholdLow ?? DEFAULT_WAITLIST_THRESHOLD_LOW;
  const highRaw = input.thresholdHigh ?? DEFAULT_WAITLIST_THRESHOLD_HIGH;

  // Defensief: clamp naar ≥ 0 en zorg dat high ≥ low.
  const low = Math.max(0, Math.floor(lowRaw));
  const high = Math.max(low, Math.floor(highRaw));

  if (available <= 0 || waiting >= high) return "long";
  if (waiting >= low) return "medium";
  return "short";
}

export interface WaitlistBadgeMeta {
  bucket: WaitlistBucket;
  label: string;
  color: string;
  bg: string;
}

export function waitlistBadgeMeta(bucket: WaitlistBucket): WaitlistBadgeMeta {
  switch (bucket) {
    case "long":
      return {
        bucket,
        label: "Lange wachtrij",
        color: "#9a3412",
        bg: "#fee2e2",
      };
    case "medium":
      return {
        bucket,
        label: "Gemiddelde wachtrij",
        color: "#92400e",
        bg: "#fef3c7",
      };
    case "short":
    default:
      return {
        bucket,
        label: "Korte wachtrij",
        color: "#166534",
        bg: "#dcfce7",
      };
  }
}
