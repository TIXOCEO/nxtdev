/**
 * Sprint 73 — Pure heuristiek "vereist beoordeling".
 *
 * Bepaalt of een submission direct op `needs_review` moet i.p.v.
 * `submitted`. Pure functie zodat ze ook in preview/tests draait.
 *
 * Triggers:
 *   1. Medische bijzonderheid ingevuld (niet-leeg).
 *   2. Leeftijd buiten programma-range (`programs.age_min/age_max`).
 *   3. Kritiek antwoord = "weet ik niet" / "onbekend".
 *   4. Sector = swimming_school maar `recommendedStageName` is null
 *      (onvoldoende niveau-data voor automatische plaatsing).
 */

export interface NeedsReviewInput {
  sectorTemplateKey: string | null | undefined;
  dateOfBirth: string | null | undefined;
  preferences: Record<string, unknown> | null | undefined;
  programAgeMin?: number | null;
  programAgeMax?: number | null;
  recommendedStageName?: string | null;
  now?: Date;
}

export interface NeedsReviewResult {
  needs: boolean;
  reasons: string[];
}

const MEDICAL_KEYS = [
  "medical_notes",
  "medical",
  "health_notes",
  "medische_bijzonderheden",
  "gezondheid",
];

const UNKNOWN_TOKENS = new Set([
  "weet ik niet",
  "weet niet",
  "onbekend",
  "geen idee",
  "?",
]);

function ageYears(dob: string | null | undefined, now: Date): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function nonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function needsReview(input: NeedsReviewInput): NeedsReviewResult {
  const reasons: string[] = [];
  const prefs = input.preferences ?? {};

  // 1. Medische bijzonderheid.
  for (const key of MEDICAL_KEYS) {
    if (nonEmptyString(prefs[key])) {
      reasons.push("Medische bijzonderheid vermeld");
      break;
    }
  }

  // 2. Leeftijd buiten range.
  const now = input.now ?? new Date();
  const age = ageYears(input.dateOfBirth, now);
  if (
    age != null &&
    ((input.programAgeMin != null && age < input.programAgeMin) ||
      (input.programAgeMax != null && age > input.programAgeMax))
  ) {
    reasons.push(
      `Leeftijd (${age}) valt buiten programma-range ${input.programAgeMin ?? "?"}-${input.programAgeMax ?? "?"}`,
    );
  }

  // 3. "Weet ik niet"-antwoorden op tekst-velden.
  for (const [k, v] of Object.entries(prefs)) {
    const s = nonEmptyString(v);
    if (s && UNKNOWN_TOKENS.has(s.toLowerCase())) {
      reasons.push(`Onbekend antwoord op "${k}"`);
      break;
    }
  }

  // 4. Zwemschool zonder herkenbaar niveau.
  const sector = (input.sectorTemplateKey ?? "").toLowerCase().trim();
  if (
    sector === "swimming_school" &&
    (input.recommendedStageName == null || input.recommendedStageName === "")
  ) {
    reasons.push("Geen automatisch herkenbaar zwem-niveau");
  }

  return { needs: reasons.length > 0, reasons };
}
