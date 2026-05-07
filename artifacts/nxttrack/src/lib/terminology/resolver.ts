import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TERMINOLOGY } from "./defaults";
import type { Terminology, TerminologyKey } from "./types";

/**
 * Merge een onbekende JSON-blob in op een Terminology baseline.
 * Niet-string waardes worden genegeerd (geen UI-breuk bij vervuilde data).
 */
function mergeIntoTerminology(
  base: Terminology,
  raw: unknown,
): Terminology {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const out: Terminology = { ...base };
  for (const key of Object.keys(base) as TerminologyKey[]) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim().length > 0) {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Server-side resolver. Per-request gememoiseerd via React `cache()`,
 * zodat meerdere componenten in dezelfde render dezelfde Supabase-call
 * delen.
 *
 * Fallback-volgorde:
 *   1. tenant.settings_json.terminology_overrides
 *   2. sector_templates[tenant.sector_template_key].terminology_json
 *   3. sector_templates['generic'].terminology_json
 *   4. DEFAULT_TERMINOLOGY (hardcoded)
 *
 * Mag NOOIT throwen — een terminology-fout mag de pagina niet kapot maken.
 */
export const getTenantTerminology = cache(async function getTenantTerminology(
  tenantId: string,
): Promise<Terminology> {
  try {
    const supabase = await createClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("sector_template_key, settings_json")
      .eq("id", tenantId)
      .maybeSingle();

    const sectorKey = (tenant?.sector_template_key as string | null) ?? null;
    const settings = (tenant?.settings_json ?? {}) as Record<string, unknown>;
    const overrides = settings.terminology_overrides;

    // Laad zowel de gewenste sector als de generic-fallback in één call.
    const wantedKeys = Array.from(
      new Set([sectorKey, "generic"].filter((k): k is string => !!k)),
    );
    const { data: templates } = wantedKeys.length
      ? await supabase
          .from("sector_templates")
          .select("key, terminology_json")
          .in("key", wantedKeys)
      : { data: [] as { key: string; terminology_json: unknown }[] };

    const byKey = new Map<string, unknown>();
    for (const t of templates ?? []) byKey.set(t.key, t.terminology_json);

    let result: Terminology = DEFAULT_TERMINOLOGY;
    result = mergeIntoTerminology(result, byKey.get("generic"));
    if (sectorKey) {
      result = mergeIntoTerminology(result, byKey.get(sectorKey));
    }
    result = mergeIntoTerminology(result, overrides);
    return result;
  } catch {
    return DEFAULT_TERMINOLOGY;
  }
});

export type { Terminology, TerminologyKey };
