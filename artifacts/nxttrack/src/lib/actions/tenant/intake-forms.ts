"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { SECTOR_DEFAULT_FORMS } from "@/lib/intake/sector-defaults";
import type { IntakeFormFieldConfig } from "@/lib/intake/types";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

const slugSchema = z
  .string()
  .min(1, "slug verplicht")
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, "alleen letters, cijfers, - en _");

const formCreateSchema = z.object({
  tenant_id: z.string().uuid(),
  slug: slugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  submission_type: z
    .enum(["registration", "trial_lesson", "waitlist_request", "information_request"])
    .default("trial_lesson"),
});

const formUpdateSchema = z.object({
  tenant_id: z.string().uuid(),
  form_id: z.string().uuid(),
  slug: slugSchema.optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  submission_type: z
    .enum(["registration", "trial_lesson", "waitlist_request", "information_request"])
    .optional(),
});

const fieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, "alleen kleine letters, cijfers en _, beginnend met een letter"),
  label: z.string().min(1).max(200),
  help_text: z.string().max(1000).optional().nullable(),
  field_type: z.enum([
    "text",
    "textarea",
    "email",
    "phone",
    "date",
    "number",
    "select",
    "multiselect",
    "radio",
    "checkbox",
    "consent",
  ]),
  is_required: z.boolean().default(false),
  options: z
    .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
    .optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      maxLength: z.number().optional(),
    })
    .partial()
    .optional(),
  show_if: z
    .object({
      field_key: z.string().min(1),
      equals: z.union([z.string(), z.number(), z.boolean()]),
    })
    .nullable()
    .optional(),
  sort_order: z.number().int().default(0),
  pii_class: z.enum(["standard", "sensitive"]).default("standard"),
  canonical_target: z
    .enum([
      "contact_name",
      "contact_email",
      "contact_phone",
      "contact_date_of_birth",
      "registration_target",
      "preferred_level",
    ])
    .nullable()
    .optional(),
});

const fieldCreateSchema = z.object({
  tenant_id: z.string().uuid(),
  form_id: z.string().uuid(),
  field: fieldSchema,
});

const fieldUpdateSchema = z.object({
  tenant_id: z.string().uuid(),
  form_id: z.string().uuid(),
  field_id: z.string().uuid(),
  field: fieldSchema.partial(),
});

const fieldRemoveSchema = z.object({
  tenant_id: z.string().uuid(),
  form_id: z.string().uuid(),
  field_id: z.string().uuid(),
});

const reorderSchema = z.object({
  tenant_id: z.string().uuid(),
  form_id: z.string().uuid(),
  ordered_field_ids: z.array(z.string().uuid()).min(1),
});

const formIdSchema = z.object({
  tenant_id: z.string().uuid(),
  form_id: z.string().uuid(),
});

const importSectorSchema = z.object({
  tenant_id: z.string().uuid(),
  sector_key: z.string().min(1),
  slug: slugSchema,
  name: z.string().min(1).max(200).optional(),
});

async function assertFormInTenant(tenantId: string, formId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("intake_forms")
    .select("id")
    .eq("id", formId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return !!data;
}

function flattenZod(err: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    out[key] = out[key] ?? [];
    out[key].push(issue.message);
  }
  return out;
}

export async function createIntakeForm(
  input: z.input<typeof formCreateSchema>,
): Promise<ActionResult<{ form_id: string }>> {
  const parsed = formCreateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.", flattenZod(parsed.error));
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_forms")
    .insert({
      tenant_id: parsed.data.tenant_id,
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: "draft",
      settings_json: { submission_type: parsed.data.submission_type },
    })
    .select("id")
    .single();
  if (error || !data) {
    return fail(error?.message ?? "Aanmaken mislukt.");
  }
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.created",
    meta: { form_id: data.id, slug: parsed.data.slug },
  });
  revalidatePath("/tenant/intake/forms");
  return { ok: true, data: { form_id: data.id } };
}

export async function updateIntakeForm(
  input: z.input<typeof formUpdateSchema>,
): Promise<ActionResult> {
  const parsed = formUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.", flattenZod(parsed.error));
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.submission_type !== undefined) {
    const { data: cur } = await admin
      .from("intake_forms")
      .select("settings_json")
      .eq("id", parsed.data.form_id)
      .maybeSingle();
    const settings = ((cur?.settings_json ?? {}) as Record<string, unknown>) || {};
    patch.settings_json = { ...settings, submission_type: parsed.data.submission_type };
  }
  const { error } = await admin
    .from("intake_forms")
    .update(patch)
    .eq("id", parsed.data.form_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.updated",
    meta: { form_id: parsed.data.form_id },
  });
  revalidatePath("/tenant/intake/forms");
  revalidatePath(`/tenant/intake/forms/${parsed.data.form_id}`);
  return { ok: true, data: undefined };
}

export async function publishIntakeForm(
  input: z.input<typeof formIdSchema>,
): Promise<ActionResult> {
  const parsed = formIdSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();
  // De DB-trigger valideert; vang errors expliciet zodat we ze
  // begrijpelijk teruggeven.
  const { error } = await admin
    .from("intake_forms")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.form_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) {
    return fail(`Publiceren geweigerd door validatie: ${error.message}`);
  }
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.published",
    meta: { form_id: parsed.data.form_id },
  });
  revalidatePath("/tenant/intake/forms");
  revalidatePath(`/tenant/intake/forms/${parsed.data.form_id}`);
  return { ok: true, data: undefined };
}

export async function archiveIntakeForm(
  input: z.input<typeof formIdSchema>,
): Promise<ActionResult> {
  const parsed = formIdSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("intake_forms")
    .update({
      status: "archived",
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.form_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.archived",
    meta: { form_id: parsed.data.form_id },
  });
  revalidatePath("/tenant/intake/forms");
  revalidatePath(`/tenant/intake/forms/${parsed.data.form_id}`);
  return { ok: true, data: undefined };
}

export async function duplicateIntakeForm(
  input: z.input<typeof formIdSchema>,
): Promise<ActionResult<{ form_id: string }>> {
  const parsed = formIdSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();
  const { data: source } = await admin
    .from("intake_forms")
    .select("slug, name, description, settings_json")
    .eq("id", parsed.data.form_id)
    .maybeSingle();
  if (!source) return fail("Bron-formulier niet gevonden.");
  const newSlug = `${source.slug}-kopie-${Date.now().toString(36)}`;
  const { data: created, error: cErr } = await admin
    .from("intake_forms")
    .insert({
      tenant_id: parsed.data.tenant_id,
      slug: newSlug,
      name: `${source.name} (kopie)`,
      description: source.description,
      status: "draft",
      settings_json: source.settings_json ?? {},
    })
    .select("id")
    .single();
  if (cErr || !created) return fail(cErr?.message ?? "Dupliceren mislukt.");

  const { data: fields } = await admin
    .from("intake_form_fields")
    .select(
      "key, label, help_text, field_type, is_required, options_json, validation_json, show_if_json, sort_order, pii_class, canonical_target",
    )
    .eq("form_id", parsed.data.form_id)
    .order("sort_order", { ascending: true });

  if (fields && fields.length > 0) {
    const insertRows = fields.map((f) => ({
      tenant_id: parsed.data.tenant_id,
      form_id: created.id,
      ...f,
    }));
    await admin.from("intake_form_fields").insert(insertRows);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.duplicated",
    meta: { source_form_id: parsed.data.form_id, new_form_id: created.id },
  });
  revalidatePath("/tenant/intake/forms");
  return { ok: true, data: { form_id: created.id } };
}

export async function setDefaultIntakeForm(
  input: z.input<typeof formIdSchema>,
): Promise<ActionResult> {
  const parsed = formIdSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();
  // Flip-via-transactie-pattern: eerst alle uit, dan deze aan.
  await admin
    .from("intake_forms")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("is_default", true);
  const { error } = await admin
    .from("intake_forms")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.form_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.updated",
    meta: { form_id: parsed.data.form_id, set_default: true },
  });
  revalidatePath("/tenant/intake/forms");
  return { ok: true, data: undefined };
}

function fieldConfigToRow(
  tenantId: string,
  formId: string,
  cfg: IntakeFormFieldConfig,
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    form_id: formId,
    key: cfg.key,
    label: cfg.label,
    help_text: cfg.help_text ?? null,
    field_type: cfg.field_type,
    is_required: cfg.is_required ?? false,
    options_json: cfg.options ?? [],
    validation_json: cfg.validation ?? {},
    show_if_json: cfg.show_if ?? null,
    sort_order: cfg.sort_order ?? 0,
    pii_class: cfg.pii_class ?? "standard",
    canonical_target: cfg.canonical_target ?? null,
  };
}

export async function addIntakeFormField(
  input: z.input<typeof fieldCreateSchema>,
): Promise<ActionResult<{ field_id: string }>> {
  const parsed = fieldCreateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.", flattenZod(parsed.error));
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();
  const row = fieldConfigToRow(
    parsed.data.tenant_id,
    parsed.data.form_id,
    parsed.data.field as IntakeFormFieldConfig,
  );
  const { data, error } = await admin
    .from("intake_form_fields")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Toevoegen mislukt.");
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.field.added",
    meta: { form_id: parsed.data.form_id, field_id: data.id, key: parsed.data.field.key },
  });
  revalidatePath(`/tenant/intake/forms/${parsed.data.form_id}/builder`);
  return { ok: true, data: { field_id: data.id } };
}

export async function updateIntakeFormField(
  input: z.input<typeof fieldUpdateSchema>,
): Promise<ActionResult> {
  const parsed = fieldUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.", flattenZod(parsed.error));
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();
  const f = parsed.data.field;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (f.key !== undefined) patch.key = f.key;
  if (f.label !== undefined) patch.label = f.label;
  if (f.help_text !== undefined) patch.help_text = f.help_text;
  if (f.field_type !== undefined) patch.field_type = f.field_type;
  if (f.is_required !== undefined) patch.is_required = f.is_required;
  if (f.options !== undefined) patch.options_json = f.options;
  if (f.validation !== undefined) patch.validation_json = f.validation;
  if (f.show_if !== undefined) patch.show_if_json = f.show_if;
  if (f.sort_order !== undefined) patch.sort_order = f.sort_order;
  if (f.pii_class !== undefined) patch.pii_class = f.pii_class;
  if (f.canonical_target !== undefined) patch.canonical_target = f.canonical_target;
  const { error } = await admin
    .from("intake_form_fields")
    .update(patch)
    .eq("id", parsed.data.field_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("form_id", parsed.data.form_id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.field.updated",
    meta: { form_id: parsed.data.form_id, field_id: parsed.data.field_id },
  });
  revalidatePath(`/tenant/intake/forms/${parsed.data.form_id}/builder`);
  return { ok: true, data: undefined };
}

export async function removeIntakeFormField(
  input: z.input<typeof fieldRemoveSchema>,
): Promise<ActionResult> {
  const parsed = fieldRemoveSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("intake_form_fields")
    .delete()
    .eq("id", parsed.data.field_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("form_id", parsed.data.form_id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.field.removed",
    meta: { form_id: parsed.data.form_id, field_id: parsed.data.field_id },
  });
  revalidatePath(`/tenant/intake/forms/${parsed.data.form_id}/builder`);
  return { ok: true, data: undefined };
}

export async function reorderIntakeFormFields(
  input: z.input<typeof reorderSchema>,
): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertFormInTenant(parsed.data.tenant_id, parsed.data.form_id))) {
    return fail("Formulier niet gevonden.");
  }
  const admin = createAdminClient();

  // Exact-set check: de payload moet precies de volledige set huidige
  // veld-ids van het form bevatten (geen duplicates, geen extras, geen
  // missing). Voorkomt inconsistente sort_orders bij stale of partiële
  // payloads.
  const { data: existing, error: exErr } = await admin
    .from("intake_form_fields")
    .select("id")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("form_id", parsed.data.form_id);
  if (exErr) return fail(exErr.message);
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const payloadIds = new Set(parsed.data.ordered_field_ids);
  if (
    parsed.data.ordered_field_ids.length !== payloadIds.size ||
    existingIds.size !== payloadIds.size ||
    [...payloadIds].some((id) => !existingIds.has(id))
  ) {
    return fail("Volgorde-payload komt niet overeen met de huidige velden.");
  }

  const updates = parsed.data.ordered_field_ids.map((id, idx) =>
    admin
      .from("intake_form_fields")
      .update({ sort_order: (idx + 1) * 10 })
      .eq("id", id)
      .eq("tenant_id", parsed.data.tenant_id)
      .eq("form_id", parsed.data.form_id),
  );
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) return fail(r.error.message);
  }
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.field.reordered",
    meta: {
      form_id: parsed.data.form_id,
      field_count: parsed.data.ordered_field_ids.length,
    },
  });
  revalidatePath(`/tenant/intake/forms/${parsed.data.form_id}/builder`);
  return { ok: true, data: undefined };
}

/**
 * Sector-default importeren als bewerkbaar tenant-form (draft).
 * Klont de fields uit `SECTOR_DEFAULT_FORMS` naar `intake_forms` +
 * `intake_form_fields`.
 */
export async function importSectorDefaultAsForm(
  input: z.input<typeof importSectorSchema>,
): Promise<ActionResult<{ form_id: string }>> {
  const parsed = importSectorSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer.", flattenZod(parsed.error));
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const source = SECTOR_DEFAULT_FORMS[parsed.data.sector_key];
  if (!source) return fail("Onbekende sector-template.");

  const admin = createAdminClient();
  const { data: created, error: cErr } = await admin
    .from("intake_forms")
    .insert({
      tenant_id: parsed.data.tenant_id,
      slug: parsed.data.slug,
      name: parsed.data.name ?? source.name,
      description: source.description ?? null,
      status: "draft",
      settings_json: { submission_type: source.submission_type },
    })
    .select("id")
    .single();
  if (cErr || !created) return fail(cErr?.message ?? "Importeren mislukt.");

  if (source.fields.length > 0) {
    const rows = source.fields.map((f) =>
      fieldConfigToRow(parsed.data.tenant_id, created.id, f),
    );
    const { error: fErr } = await admin.from("intake_form_fields").insert(rows);
    if (fErr) {
      // Best-effort cleanup van het form als velden falen.
      await admin.from("intake_forms").delete().eq("id", created.id);
      return fail(`Veld-import mislukt: ${fErr.message}`);
    }
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "intake.form.created",
    meta: {
      form_id: created.id,
      slug: parsed.data.slug,
      imported_from: parsed.data.sector_key,
    },
  });
  revalidatePath("/tenant/intake/forms");
  return { ok: true, data: { form_id: created.id } };
}
