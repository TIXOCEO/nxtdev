"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const inputSchema = z.object({
  tenant_id: z.string().uuid(),
  intake_default: z.enum(["registration", "waitlist"]),
  // Optionele per-target overrides; lege of `default`-waarde verwijdert de override.
  intake_overrides_by_target: z
    .record(z.string(), z.enum(["registration", "waitlist", "default"]))
    .default({}),
});

export type UpdateIntakeSettingsInput = z.infer<typeof inputSchema>;

/**
 * Sprint 49 — Tenant-admin-scoped instelling voor de intake-routing
 * van het publieke aanmeldformulier. Schrijft naar
 * `tenants.settings_json.intake_default` (+ optionele overrides) en
 * laat andere settings ongemoeid.
 */
export async function updateIntakeSettings(
  input: UpdateIntakeSettingsInput,
): Promise<ActionResult<{ tenant_id: string }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ongeldige invoer",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
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

  const current = (existing.settings_json ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };
  next.intake_default = parsed.data.intake_default;

  // Strip 'default' / lege waarden uit de overrides-map.
  const overrides: Record<string, "registration" | "waitlist"> = {};
  for (const [k, v] of Object.entries(parsed.data.intake_overrides_by_target)) {
    if (v === "registration" || v === "waitlist") overrides[k] = v;
  }
  if (Object.keys(overrides).length === 0) {
    delete next.intake_overrides_by_target;
  } else {
    next.intake_overrides_by_target = overrides;
  }

  const { error: updErr } = await supabase
    .from("tenants")
    .update({ settings_json: next })
    .eq("id", parsed.data.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "tenant_intake.update",
    meta: {
      intake_default: parsed.data.intake_default,
      override_count: Object.keys(overrides).length,
    },
  });

  revalidatePath("/tenant/registrations");
  revalidatePath("/tenant/registrations/instellingen");
  return { ok: true, data: { tenant_id: parsed.data.tenant_id } };
}
