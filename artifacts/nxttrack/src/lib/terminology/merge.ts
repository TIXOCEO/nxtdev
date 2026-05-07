import { DEFAULT_TERMINOLOGY } from "./defaults.ts";
import { safeParseTerminology } from "./schema.ts";
import type { Terminology } from "./types.ts";

/**
 * Merge een onbekende JSON-blob in op een Terminology baseline. Gebruikt
 * `safeParseTerminology` (Zod) als ingestie-grens: vervuilde / partial
 * input wordt gefilterd, onbekende keys gestript, lege strings genegeerd.
 * Faalt nooit — bij parse-error blijft `base` ongewijzigd.
 */
export function mergeIntoTerminology(
  base: Terminology,
  raw: unknown,
): Terminology {
  const partial = safeParseTerminology(raw);
  return { ...base, ...partial };
}

/**
 * Pure resolver-kern: pas de fallback-keten toe op losse JSON-blobs.
 * Géén Supabase / IO — apart van `resolver.ts` zodat deze in unit-tests
 * (en straks in een platform-admin preview) zonder server-context werkt.
 *
 * Volgorde (laagste → hoogste prioriteit):
 *   1. DEFAULT_TERMINOLOGY (TS-hardcoded)
 *   2. genericTemplate?.terminology_json
 *   3. sectorTemplate?.terminology_json
 *   4. tenantOverrides
 */
export function resolveTerminology(input: {
  generic?: unknown;
  sector?: unknown;
  overrides?: unknown;
}): Terminology {
  let result: Terminology = { ...DEFAULT_TERMINOLOGY };
  result = mergeIntoTerminology(result, input.generic);
  result = mergeIntoTerminology(result, input.sector);
  result = mergeIntoTerminology(result, input.overrides);
  return result;
}
