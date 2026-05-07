"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { safeParseTerminology } from "@/lib/terminology/schema";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const inputSchema = z.object({
  tenant_id: z.string().uuid(),
  // Vrije bag van keys; safeParseTerminology stript onbekende/lege keys.
  terminology_overrides: z.record(z.string(), z.string()).default({}),
});

export type UpdateTenantTerminologyOverridesInput = z.infer<typeof inputSchema>;

/**
 * Tenant-admin-scoped editor voor `tenants.settings_json.terminology_overrides`.
 *
 * - `sector_template_key` blijft expliciet ongemoeid (platform-only).
 * - Lege strings → key wordt verwijderd uit overrides.
 * - Lege overrides → de hele `terminology_overrides` sub-key wordt verwijderd
 *   uit `settings_json` (opruim).
 * - Andere keys onder `settings_json` blijven intact.
 */
export async function updateTenantTerminologyOverrides(
  input: UpdateTenantTerminologyOverridesInput,
): Promise<ActionResult<{ tenant_id: string; override_count: number }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ongeldige invoer", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();

  const { data: existing, error: readErr } = await supabase
    .from("tenants")
    .select("settings_json")
    .eq("id", parsed.data.tenant_id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: "Onbekende tenant." };

  const currentSettings = (existing.settings_json ?? {}) as Record<string, unknown>;
  const cleanedOverrides = safeParseTerminology(parsed.data.terminology_overrides);
  const priorOverrides =
    (currentSettings.terminology_overrides as Record<string, unknown> | undefined) ?? {};

  const nextSettings: Record<string, unknown> = { ...currentSettings };
  if (Object.keys(cleanedOverrides).length === 0) {
    delete nextSettings.terminology_overrides;
  } else {
    nextSettings.terminology_overrides = cleanedOverrides;
  }

  const { error: updErr } = await supabase
    .from("tenants")
    .update({ settings_json: nextSettings })
    .eq("id", parsed.data.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  // Audit-log: noteer welke keys zijn toegevoegd/aangepast/verwijderd.
  const before = priorOverrides as Record<string, unknown>;
  const after = cleanedOverrides as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of allKeys) {
    if ((before[k] ?? null) !== (after[k] ?? null)) changed.push(k);
  }
  if (changed.length > 0) {
    await recordAudit({
      tenant_id: parsed.data.tenant_id,
      actor_user_id: user.id,
      action: "tenant_terminology.update",
      meta: {
        changed: changed.join(","),
        override_count: Object.keys(after).length,
      },
    });
  }

  revalidatePath("/tenant");
  revalidatePath("/tenant/profile");
  return {
    ok: true,
    data: { tenant_id: parsed.data.tenant_id, override_count: Object.keys(cleanedOverrides).length },
  };
}
