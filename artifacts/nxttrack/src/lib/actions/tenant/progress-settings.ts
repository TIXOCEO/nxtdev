"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const renderInputSchema = z.object({
  tenant_id: z.string().uuid(),
  progress_render_style: z.enum(["text", "stars", "emoji"]),
});
export type UpdateProgressRenderStyleInput = z.infer<typeof renderInputSchema>;

/**
 * Sprint 51 — Tenant-instelling: hoe wordt een voortgangslabel getoond?
 *  - text   = pure tekst-badge (default; toegankelijk fallback voor screenreaders)
 *  - stars  = 1-5 sterren (gebruikt scoring_labels.star_value)
 *  - emoji  = enkele emoji (gebruikt scoring_labels.emoji)
 *
 * Schermlezers blijven altijd het tekst-label horen — wat hier wijzigt is
 * uitsluitend de visuele rendering in de voortgangsweergave.
 */
export async function updateProgressRenderStyle(
  input: UpdateProgressRenderStyleInput,
): Promise<ActionResult<{ tenant_id: string }>> {
  const parsed = renderInputSchema.safeParse(input);
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
  const next: Record<string, unknown> = {
    ...current,
    progress_render_style: parsed.data.progress_render_style,
  };

  const { error: updErr } = await supabase
    .from("tenants")
    .update({ settings_json: next })
    .eq("id", parsed.data.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "tenant_progress_settings.update",
    meta: { progress_render_style: parsed.data.progress_render_style },
  });

  revalidatePath("/tenant/voortgang");
  return { ok: true, data: { tenant_id: parsed.data.tenant_id } };
}

// ────────────────────────────────────────────────────────────────────
// Scoring-label CRUD — minimaal genoeg om de instellingen-pagina te laten werken.
// ────────────────────────────────────────────────────────────────────

const labelInputSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/i, "Alleen letters, cijfers, '-' en '_'."),
  name: z.string().min(1).max(80),
  color: z.string().max(20).optional().nullable(),
  emoji: z.string().max(8).optional().nullable(),
  star_value: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .nullable(),
  sort_order: z.number().int().min(0).max(999).default(0),
});
export type UpsertScoringLabelInput = z.infer<typeof labelInputSchema>;

/**
 * Upsert van een positief scoring-label. `is_positive_outcome` blijft DB-side
 * vastgepind op `true` (DB-check zal afkeurende labels weigeren).
 */
export async function upsertScoringLabel(
  input: UpsertScoringLabelInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = labelInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ongeldige invoer",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const row = {
    tenant_id: parsed.data.tenant_id,
    slug: parsed.data.slug,
    name: parsed.data.name,
    color: parsed.data.color ?? null,
    emoji: parsed.data.emoji ?? null,
    star_value: parsed.data.star_value ?? null,
    sort_order: parsed.data.sort_order,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("scoring_labels")
      .update(row)
      .eq("id", parsed.data.id)
      .eq("tenant_id", parsed.data.tenant_id)
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Niet gevonden." };
    await recordAudit({
      tenant_id: parsed.data.tenant_id,
      actor_user_id: user.id,
      action: "scoring_label.update",
      meta: { label_id: data.id, slug: row.slug },
    });
    revalidatePath("/tenant/voortgang");
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("scoring_labels")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Aanmaken mislukt." };
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "scoring_label.create",
    meta: { label_id: data.id, slug: row.slug },
  });
  revalidatePath("/tenant/voortgang");
  return { ok: true, data: { id: data.id } };
}

const deleteSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
});

export async function deleteScoringLabel(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { error } = await supabase
    .from("scoring_labels")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "scoring_label.delete",
    meta: { label_id: parsed.data.id },
  });
  revalidatePath("/tenant/voortgang");
  return { ok: true, data: undefined };
}
