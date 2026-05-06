"use server";

import { revalidatePath } from "next/cache";
import { assertTenantAccess } from "./_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  upsertSectionSchema,
  upsertFieldSchema,
  reorderSchema,
  reorderFieldsSchema,
  deleteSchema,
  saveAnswersBulkSchema,
} from "@/lib/validation/trainer-bio";
import { ensureTrainerBioTemplate } from "@/lib/db/trainer-bio";
import { getUser } from "@/lib/auth/get-user";
import type { z } from "zod";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidate(tenantSlug?: string) {
  revalidatePath("/tenant/cms/trainer-bio");
  revalidatePath("/t", "layout");
  if (tenantSlug) revalidatePath(`/t/${tenantSlug}/trainers`, "page");
}

function slugifyKey(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || `f_${Date.now().toString(36)}`
  );
}

export async function ensureTemplate(input: {
  tenant_id: string;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  await ensureTrainerBioTemplate(input.tenant_id);
  revalidate();
  return { ok: true, data: undefined };
}

export async function upsertSection(
  input: z.infer<typeof upsertSectionSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = upsertSectionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  if (parsed.data.id) {
    const { error } = await admin
      .from("trainer_bio_sections")
      .update({
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        is_active: parsed.data.is_active,
      })
      .eq("id", parsed.data.id)
      .eq("tenant_id", parsed.data.tenant_id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, data: { id: parsed.data.id } };
  }

  const { data: maxRow } = await admin
    .from("trainer_bio_sections")
    .select("sort_order")
    .eq("tenant_id", parsed.data.tenant_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder =
    ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await admin
    .from("trainer_bio_sections")
    .insert({
      tenant_id: parsed.data.tenant_id,
      key: `${slugifyKey(parsed.data.label)}_${Date.now().toString(36)}`,
      label: parsed.data.label,
      description: parsed.data.description ?? null,
      sort_order: nextOrder,
      is_active: parsed.data.is_active,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert mislukt" };
  revalidate();
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function deleteSection(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult<void>> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("trainer_bio_sections")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function reorderSections(
  input: z.infer<typeof reorderSchema>,
): Promise<ActionResult<void>> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  for (let i = 0; i < parsed.data.ordered_ids.length; i++) {
    const { error } = await admin
      .from("trainer_bio_sections")
      .update({ sort_order: i })
      .eq("id", parsed.data.ordered_ids[i])
      .eq("tenant_id", parsed.data.tenant_id);
    if (error) return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true, data: undefined };
}

export async function upsertField(
  input: z.infer<typeof upsertFieldSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = upsertFieldSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  if (parsed.data.id) {
    const { error } = await admin
      .from("trainer_bio_fields")
      .update({
        label: parsed.data.label,
        field_type: parsed.data.field_type,
        is_active: parsed.data.is_active,
      })
      .eq("id", parsed.data.id)
      .eq("tenant_id", parsed.data.tenant_id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, data: { id: parsed.data.id } };
  }

  const { data: maxRow } = await admin
    .from("trainer_bio_fields")
    .select("sort_order")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("section_id", parsed.data.section_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder =
    ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await admin
    .from("trainer_bio_fields")
    .insert({
      tenant_id: parsed.data.tenant_id,
      section_id: parsed.data.section_id,
      key: `${slugifyKey(parsed.data.label)}_${Date.now().toString(36)}`,
      label: parsed.data.label,
      field_type: parsed.data.field_type,
      sort_order: nextOrder,
      is_active: parsed.data.is_active,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert mislukt" };
  revalidate();
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function deleteField(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult<void>> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("trainer_bio_fields")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function reorderFields(
  input: z.infer<typeof reorderFieldsSchema>,
): Promise<ActionResult<void>> {
  const parsed = reorderFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  for (let i = 0; i < parsed.data.ordered_ids.length; i++) {
    const { error } = await admin
      .from("trainer_bio_fields")
      .update({ sort_order: i })
      .eq("id", parsed.data.ordered_ids[i])
      .eq("tenant_id", parsed.data.tenant_id)
      .eq("section_id", parsed.data.section_id);
    if (error) return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true, data: undefined };
}

/**
 * Trainer (of beheerder) slaat eigen antwoorden op. Authorisatie: caller moet
 * óf admin in de tenant zijn, óf de eigenaar van de member-row (user_id match).
 */
export async function saveAnswers(
  input: z.infer<typeof saveAnswersBulkSchema>,
): Promise<ActionResult<void>> {
  const parsed = saveAnswersBulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldig" };

  const user = await getUser();
  if (!user) return { ok: false, error: "Niet ingelogd" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, user_id, tenant_id")
    .eq("id", parsed.data.member_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!member) return { ok: false, error: "Lid niet gevonden" };

  const ownsMember =
    (member as { user_id: string | null }).user_id === user.id;
  if (!ownsMember) {
    // Fallback naar admin-check (gooit als geen toegang).
    try {
      await assertTenantAccess(parsed.data.tenant_id);
    } catch {
      return { ok: false, error: "Geen toegang" };
    }
  }

  // Sprint 30 — Trainer-eligibility check: target member moet trainer zijn
  // (system role 'trainer' of tenant-rol met is_trainer_role=true). Voorkomt
  // dat niet-trainers publiek leesbare trainer-bio rijen kunnen aanmaken.
  const [{ data: sysTrainerRows }, { data: customRoleRows }] = await Promise.all([
    admin
      .from("member_roles")
      .select("role")
      .eq("member_id", parsed.data.member_id)
      .eq("role", "trainer")
      .limit(1),
    admin
      .from("tenant_member_roles")
      .select("tenant_roles!inner(is_trainer_role)")
      .eq("tenant_id", parsed.data.tenant_id)
      .eq("member_id", parsed.data.member_id),
  ]);
  type TrRow = {
    tenant_roles:
      | { is_trainer_role: boolean }
      | { is_trainer_role: boolean }[]
      | null;
  };
  const isCustomTrainer = ((customRoleRows ?? []) as TrRow[]).some((r) => {
    const list = Array.isArray(r.tenant_roles)
      ? r.tenant_roles
      : r.tenant_roles
        ? [r.tenant_roles]
        : [];
    return list.some((tr) => tr.is_trainer_role);
  });
  const isSysTrainer = (sysTrainerRows ?? []).length > 0;
  if (!isSysTrainer && !isCustomTrainer) {
    return { ok: false, error: "Lid is geen trainer" };
  }

  // Valideer dat alle field_ids tot deze tenant horen.
  const fieldIds = parsed.data.answers.map((a) => a.field_id);
  if (fieldIds.length === 0) return { ok: true, data: undefined };
  const { data: fields } = await admin
    .from("trainer_bio_fields")
    .select("id, tenant_id, field_type, is_active")
    .in("id", fieldIds);
  const okFields = new Set(
    ((fields ?? []) as Array<{
      id: string;
      tenant_id: string;
      is_active: boolean;
    }>)
      .filter((f) => f.tenant_id === parsed.data.tenant_id && f.is_active)
      .map((f) => f.id),
  );

  for (const a of parsed.data.answers) {
    if (!okFields.has(a.field_id)) continue;
    const { error } = await admin
      .from("trainer_bio_answers")
      .upsert(
        {
          tenant_id: parsed.data.tenant_id,
          member_id: parsed.data.member_id,
          field_id: a.field_id,
          value_text: a.value_text ?? null,
          value_number: a.value_number ?? null,
          value_date: a.value_date ?? null,
          value_list: a.value_list ?? null,
        },
        { onConflict: "member_id,field_id" },
      );
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/t`, "layout");
  return { ok: true, data: undefined };
}
