/**
 * Sprint 73 — Pure rule-based stage-aanbeveling.
 *
 * Geeft een **stage-naam** terug (geen UUID); de caller doet de
 * name→id-lookup binnen het programma in de DB. Naam-vergelijking is
 * case-insensitive en wit-ruimte-tolerant (zie `findStageIdByName`).
 *
 * Regels zijn sector-specifiek en bewust simpel. Onbekende/ontbrekende
 * input → `null` zodat het systeem `needs_review` kan triggeren in
 * plaats van een verkeerde stage te kiezen.
 *
 * Pure functie: geen DB-roundtrip, geen side-effects — herbruikbaar in
 * preview/builder/tests.
 */

export interface RecommendStageInput {
  sectorTemplateKey: string | null | undefined;
  dateOfBirth: string | null | undefined;
  preferences: Record<string, unknown> | null | undefined;
  /** Referentie voor leeftijdsberekening; default = `new Date()`. */
  now?: Date;
}

export interface RecommendStageResult {
  /** Stage-naam zoals die in `program_stages.name` zou moeten staan. */
  stageName: string | null;
  /** Korte uitleg waarom (voor audit/UI tooltip). */
  rationale: string;
}

function ageYears(dob: string | null | undefined, now: Date): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function pickString(
  prefs: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!prefs) return null;
  const v = prefs[key];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
}

function pickBool(
  prefs: Record<string, unknown> | null | undefined,
  key: string,
): boolean | null {
  if (!prefs) return null;
  const v = prefs[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["ja", "yes", "true", "1"].includes(s)) return true;
    if (["nee", "no", "false", "0"].includes(s)) return false;
  }
  return null;
}

/**
 * Zwemschool — 5 default stages: Watergewenning, Drijven,
 * Schoolslag basis, Rugslag basis, Afzwem-ready.
 *
 * Regels (volgorde matters; eerste match wint):
 *   - Geen ervaring / kan niet drijven → "Watergewenning"
 *   - Kan drijven maar niet onder water → "Drijven"
 *   - Werkt aan A → "Schoolslag basis"
 *   - Werkt aan B → "Rugslag basis"
 *   - Werkt aan C → "Afzwem-ready"
 *   - Anders → null (geen aanname; admin kiest zelf)
 */
function recommendSwimming(
  input: RecommendStageInput,
): RecommendStageResult {
  const level = pickString(input.preferences, "preferred_level") ??
    pickString(input.preferences, "current_level");
  const floats = pickBool(input.preferences, "can_float");
  const underwater = pickBool(input.preferences, "underwater_comfort");

  if (level === "c") {
    return { stageName: "Afzwem-ready", rationale: "Werkt aan zwemdiploma C" };
  }
  if (level === "b") {
    return { stageName: "Rugslag basis", rationale: "Werkt aan zwemdiploma B" };
  }
  if (level === "a") {
    return { stageName: "Schoolslag basis", rationale: "Werkt aan zwemdiploma A" };
  }
  if (level === "watervrij") {
    return { stageName: "Watergewenning", rationale: "Watervrij / geen ervaring" };
  }
  if (floats === false) {
    return { stageName: "Watergewenning", rationale: "Kan nog niet drijven" };
  }
  if (floats === true && underwater === false) {
    return { stageName: "Drijven", rationale: "Drijft wel, onder water nog niet" };
  }
  return {
    stageName: null,
    rationale: "Onvoldoende niveau-data voor automatische aanbeveling",
  };
}

/**
 * Voetbalschool — leeftijdsklasse op basis van leeftijd op 1 jan
 * van het lopende jaar (KNVB-conventie vereenvoudigd: gebruik de
 * leeftijd op de referentiedatum, niet exact KNVB-peildatum, anders
 * heeft de regel een DB-roundtrip nodig).
 *
 * O7 = onder 7, O9 = 7-8, O11 = 9-10, O13 = 11-12, O15 = 13-14,
 * O17 = 15-16, O19 = 17-18.
 */
function recommendFootball(
  input: RecommendStageInput,
): RecommendStageResult {
  const now = input.now ?? new Date();
  const age = ageYears(input.dateOfBirth, now);
  if (age == null) {
    return {
      stageName: null,
      rationale: "Geen geboortedatum bekend",
    };
  }
  if (age < 7) return { stageName: "O7", rationale: `Leeftijd ${age}` };
  if (age < 9) return { stageName: "O9", rationale: `Leeftijd ${age}` };
  if (age < 11) return { stageName: "O11", rationale: `Leeftijd ${age}` };
  if (age < 13) return { stageName: "O13", rationale: `Leeftijd ${age}` };
  if (age < 15) return { stageName: "O15", rationale: `Leeftijd ${age}` };
  if (age < 17) return { stageName: "O17", rationale: `Leeftijd ${age}` };
  if (age < 19) return { stageName: "O19", rationale: `Leeftijd ${age}` };
  return { stageName: null, rationale: `Leeftijd ${age} valt buiten jeugdklassen` };
}

/**
 * Top-level dispatcher. Onbekende sector → null + uitleg.
 */
export function recommendStage(input: RecommendStageInput): RecommendStageResult {
  const sector = (input.sectorTemplateKey ?? "").toLowerCase().trim();
  switch (sector) {
    case "swimming_school":
      return recommendSwimming(input);
    case "football_school":
      return recommendFootball(input);
    default:
      return {
        stageName: null,
        rationale: "Sector heeft geen automatische stage-regels",
      };
  }
}
