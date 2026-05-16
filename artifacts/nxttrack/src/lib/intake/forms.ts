import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectorDefaultForm } from "./sector-defaults";
import type { IntakeFormConfig, IntakeFormFieldConfig } from "./types";

/**
 * Sprint 65 — Resolveer het effectieve intake-formulier voor een tenant.
 *
 * Cascade:
 *   1. `programs.intake_form_id` (toekomstige Sprint 66/68 — kolom
 *      bestaat nog niet, dus deze stap is een no-op in MVP).
 *   2. `tenants.settings_json.intake_default_form_id` → DB-lookup.
 *   3. Een ander gepubliceerd `is_default=true`-formulier in
 *      `intake_forms` voor deze tenant.
 *   4. Code-side sector-default uit `getSectorDefaultForm()`.
 */

interface IntakeFormDbRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  updated_at: string;
  settings_json: Record<string, unknown> | null;
}

interface IntakeFormFieldDbRow {
  id: string;
  form_id: string;
  key: string;
  label: string;
  help_text: string | null;
  field_type: IntakeFormFieldConfig["field_type"];
  is_required: boolean;
  options_json: unknown;
  validation_json: unknown;
  show_if_json: unknown;
  sort_order: number;
  pii_class: "standard" | "sensitive";
  canonical_target: string | null;
}

function rowToFieldConfig(
  r: IntakeFormFieldDbRow,
): IntakeFormFieldConfig {
  const options = Array.isArray(r.options_json)
    ? (r.options_json as IntakeFormFieldConfig["options"])
    : [];
  const validation =
    r.validation_json && typeof r.validation_json === "object"
      ? (r.validation_json as IntakeFormFieldConfig["validation"])
      : {};
  const showIf =
    r.show_if_json &&
    typeof r.show_if_json === "object" &&
    !Array.isArray(r.show_if_json)
      ? (r.show_if_json as IntakeFormFieldConfig["show_if"])
      : null;
  return {
    key: r.key,
    label: r.label,
    help_text: r.help_text,
    field_type: r.field_type,
    is_required: r.is_required,
    options,
    validation,
    show_if: showIf,
    sort_order: r.sort_order,
    pii_class: r.pii_class,
    canonical_target:
      (r.canonical_target as IntakeFormFieldConfig["canonical_target"]) ?? null,
  };
}

async function loadFormFromDb(
  tenantId: string,
  formId?: string | null,
): Promise<IntakeFormConfig | null> {
  const admin = createAdminClient();
  let query = admin
    .from("intake_forms")
    .select("id, slug, name, description, status, is_default, updated_at, settings_json")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .limit(1);
  if (formId) query = query.eq("id", formId);
  else query = query.eq("is_default", true);

  const { data: formRow } = await query.maybeSingle();
  if (!formRow) return null;
  const f = formRow as IntakeFormDbRow;

  const { data: fieldRows } = await admin
    .from("intake_form_fields")
    .select(
      "id, form_id, key, label, help_text, field_type, is_required, options_json, validation_json, show_if_json, sort_order, pii_class, canonical_target",
    )
    .eq("tenant_id", tenantId)
    .eq("form_id", f.id)
    .order("sort_order", { ascending: true });

  const fields = (fieldRows ?? []).map((r) =>
    rowToFieldConfig(r as IntakeFormFieldDbRow),
  );

  const settings = (f.settings_json ?? {}) as Record<string, unknown>;
  const submissionType =
    (settings.submission_type as IntakeFormConfig["submission_type"]) ??
    "trial_lesson";

  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    description: f.description,
    status: f.status,
    is_default: f.is_default,
    submission_type: submissionType,
    updated_at: f.updated_at,
    fields,
    source: "db",
  };
}

export async function resolveIntakeForm(args: {
  tenantId: string;
  sectorTemplateKey: string | null | undefined;
  settingsJson: Record<string, unknown>;
  /**
   * Optioneel — wanneer een programma is gekozen via `?program=…`,
   * lookupt de caller eerst zelf `programs.intake_form_id`. Sprint 65
   * gebruikt dit nog niet (kolom bestaat in een latere sprint); we
   * accepteren het parameter zodat callers stabiel blijven.
   */
  programIntakeFormId?: string | null;
}): Promise<IntakeFormConfig> {
  const {
    tenantId,
    sectorTemplateKey,
    settingsJson,
    programIntakeFormId,
  } = args;

  if (programIntakeFormId) {
    const fromProgram = await loadFormFromDb(tenantId, programIntakeFormId);
    if (fromProgram) return fromProgram;
  }

  const defaultId =
    typeof settingsJson?.intake_default_form_id === "string"
      ? (settingsJson.intake_default_form_id as string)
      : null;
  if (defaultId) {
    const fromSettings = await loadFormFromDb(tenantId, defaultId);
    if (fromSettings) return fromSettings;
  }

  const anyDefault = await loadFormFromDb(tenantId, null);
  if (anyDefault) return anyDefault;

  return getSectorDefaultForm(sectorTemplateKey);
}

export function isDynamicIntakeEnabled(
  settingsJson: Record<string, unknown> | null | undefined,
): boolean {
  if (!settingsJson) return false;
  return settingsJson["dynamic_intake_enabled"] === true;
}
