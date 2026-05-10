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
  // Sprint 64 — Optionele per-programma overrides. Sleutel = `programs.public_slug`
  // (niet program_id) zodat de waarde stabiel blijft als de admin de URL kent.
  // Een 'default'-waarde verwijdert de override.
  intake_overrides_by_program: z
    .record(z.string(), z.enum(["registration", "waitlist", "default"]))
    .default({}),
});

export type UpdateIntakeSettingsInput = z.infer<typeof inputSchema>;

/**
 * Sprint 49 — Tenant-admin-scoped instelling voor de intake-routing
 * van het publieke aanmeldformulier. Schrijft naar
 * `tenants.settings_json.intake_default` (+ optionele overrides) en
 * laat andere settings ongemoeid.
 *
 * Sprint 64 — Uitgebreid met `intake_overrides_by_program` (sleutel =
 * `programs.public_slug`). De cascade in de publieke registratie-actie is
 * `program → target → default`.
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

  // Strip 'default' / lege waarden uit beide override-maps. Een lege map
  // verwijderen we volledig zodat oude rijen die ooit met overrides werden
  // gevuld weer naar "geen overrides" terug kunnen.
  const targetOverrides: Record<string, "registration" | "waitlist"> = {};
  for (const [k, v] of Object.entries(parsed.data.intake_overrides_by_target)) {
    if (v === "registration" || v === "waitlist") targetOverrides[k] = v;
  }
  if (Object.keys(targetOverrides).length === 0) {
    delete next.intake_overrides_by_target;
  } else {
    next.intake_overrides_by_target = targetOverrides;
  }

  const programOverrides: Record<string, "registration" | "waitlist"> = {};
  for (const [k, v] of Object.entries(parsed.data.intake_overrides_by_program)) {
    if (v === "registration" || v === "waitlist") programOverrides[k] = v;
  }
  if (Object.keys(programOverrides).length === 0) {
    delete next.intake_overrides_by_program;
  } else {
    next.intake_overrides_by_program = programOverrides;
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
      override_count: Object.keys(targetOverrides).length,
      program_override_count: Object.keys(programOverrides).length,
    },
  });

  revalidatePath("/tenant/registrations");
  revalidatePath("/tenant/registrations/instellingen");
  return { ok: true, data: { tenant_id: parsed.data.tenant_id } };
}
