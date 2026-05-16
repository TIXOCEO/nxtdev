"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveIntakeForm, isDynamicIntakeEnabled } from "@/lib/intake/forms";
import {
  buildZodFromFormConfigMemo,
  isFieldVisible,
} from "@/lib/intake/build-schema";
import { buildAnswerRow } from "@/lib/intake/answers";
import type {
  IntakeFormConfig,
  IntakeSubmissionPayload,
} from "@/lib/intake/types";
import { sendEmail } from "@/lib/email/send-email";
import { recordAudit } from "@/lib/audit/log";
import { sendNotification } from "@/lib/notifications/send-notification";

/**
 * Sprint 65 — Server action voor publieke dynamic-intake submissions.
 *
 * Flow:
 *  1. Tenant + form-config server-side resolven (nooit client-trusted).
 *  2. Schema opnieuw bouwen + valideren.
 *  3. Verborgen velden uit payload strippen.
 *  4. `intake_submissions`-rij + per-veld `submission_answers` inserten.
 *  5. Fire-and-forget: tenant-email `intake_submitted`.
 *
 * Geeft een PublicActionResult-discriminated union terug zodat de
 * client-side renderer field-errors kan tonen.
 */

export type IntakeActionResult =
  | { ok: true; data: { submissionId: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): IntakeActionResult {
  return { ok: false, error, fieldErrors };
}

async function resolveTenant(slug: string): Promise<{
  id: string;
  sector_template_key: string | null;
  settings_json: Record<string, unknown>;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, sector_template_key, settings_json, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  if ((data as { status?: string }).status !== "active") return null;
  return {
    id: (data as { id: string }).id,
    sector_template_key:
      (data as { sector_template_key: string | null }).sector_template_key ??
      null,
    settings_json:
      ((data as { settings_json: Record<string, unknown> | null })
        .settings_json as Record<string, unknown> | null) ?? {},
  };
}

export async function submitIntake(
  payload: IntakeSubmissionPayload,
): Promise<IntakeActionResult> {
  if (!payload?.tenant_slug || typeof payload.tenant_slug !== "string") {
    return fail("Ongeldige aanvraag.");
  }

  const tenant = await resolveTenant(payload.tenant_slug);
  if (!tenant) return fail("Deze pagina is niet langer beschikbaar.");

  if (!isDynamicIntakeEnabled(tenant.settings_json)) {
    return fail("Dynamic intake is niet ingeschakeld voor deze tenant.");
  }

  const form: IntakeFormConfig = await resolveIntakeForm({
    tenantId: tenant.id,
    sectorTemplateKey: tenant.sector_template_key,
    settingsJson: tenant.settings_json,
    programIntakeFormId: null,
  });

  const schema = buildZodFromFormConfigMemo(form);
  const parsed = schema.safeParse(payload.answers ?? {});
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return fail("Ongeldige invoer", flat.fieldErrors as Record<string, string[]>);
  }

  // Strip verborgen velden — verminder PII-opslag en voorkom dat
  // stale waarden meeloggen naar de DB.
  const values = parsed.data as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const f of form.fields) {
    if (!isFieldVisible(f.show_if, values)) continue;
    if (values[f.key] !== undefined) cleaned[f.key] = values[f.key];
  }

  // Canonical-targets uitlezen voor gedenormaliseerde kolommen.
  let contact_name: string | null = null;
  let contact_email: string | null = null;
  let contact_phone: string | null = null;
  let contact_dob: string | null = null;
  let registration_target: "self" | "child" | null = null;
  for (const f of form.fields) {
    const v = cleaned[f.key];
    if (f.canonical_target === "contact_name" && typeof v === "string")
      contact_name = v;
    if (f.canonical_target === "contact_email" && typeof v === "string")
      contact_email = v;
    if (f.canonical_target === "contact_phone" && typeof v === "string")
      contact_phone = v;
    if (f.canonical_target === "contact_date_of_birth" && typeof v === "string")
      contact_dob = v;
    if (f.canonical_target === "registration_target" && typeof v === "string")
      registration_target = v === "child" ? "child" : "self";
    // Sprint 71 — kopieer canonical-target preferred_level naar een
    // stabiele key in preferences_json zodat score_placement_candidates
    // niet hoeft te raden welk veld het niveau bevat.
    if (
      f.canonical_target === "preferred_level" &&
      typeof v === "string" &&
      v.trim() !== ""
    ) {
      cleaned["preferred_level"] = v;
    }
  }

  const admin = createAdminClient();
  const isDbForm = form.source === "db";

  const { data: subRow, error: subErr } = await admin
    .from("intake_submissions")
    .insert({
      tenant_id: tenant.id,
      form_id: isDbForm ? form.id : null,
      submission_type: form.submission_type,
      status: "submitted",
      registration_target,
      contact_name,
      contact_email,
      contact_phone,
      contact_date_of_birth: contact_dob,
      agreed_terms: Boolean(cleaned["agreed_terms"]),
      preferences_json: cleaned,
    })
    .select("id")
    .single();

  if (subErr || !subRow) {
    return fail(
      subErr?.message ?? "Aanmelding kon niet worden verwerkt. Probeer het opnieuw.",
    );
  }
  const submissionId = (subRow as { id: string }).id;

  // Per-veld answer-rows. Best-effort: één gefaalde batch mag de
  // submission niet ongedaan maken, maar we loggen wel.
  const answerRows = form.fields
    .filter((f) => isFieldVisible(f.show_if, values))
    .filter((f) => cleaned[f.key] !== undefined && cleaned[f.key] !== "")
    .map((f) => {
      const row = buildAnswerRow({
        field_key: f.key,
        field_type: f.field_type,
        field_id: null,
        raw: cleaned[f.key],
      });
      return {
        tenant_id: tenant.id,
        submission_id: submissionId,
        field_id: null,
        field_key: row.field_key,
        value_text: row.value_text,
        value_number: row.value_number,
        value_date: row.value_date,
        value_bool: row.value_bool,
        value_json: row.value_json,
      };
    });

  if (answerRows.length > 0) {
    const { error: ansErr } = await admin
      .from("submission_answers")
      .insert(answerRows);
    if (ansErr) {
      // eslint-disable-next-line no-console
      console.error("[intake] answers insert failed:", ansErr.message);
    }
  }

  // Fire-and-forget bevestigingsmail naar de indiener.
  if (contact_email) {
    void sendEmail({
      tenantId: tenant.id,
      templateKey: "intake_submitted",
      to: contact_email,
      triggerSource: "intake.submit",
      variables: {
        contact_name: contact_name ?? "",
        form_name: form.name,
      },
    }).catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[intake] send email failed:", e);
    });
  }

  // Audit-event (best-effort, blokkeert nooit).
  void recordAudit({
    tenant_id: tenant.id,
    actor_user_id: "00000000-0000-0000-0000-000000000000",
    action: "intake.submission.created",
    meta: {
      submission_id: submissionId,
      submission_type: form.submission_type,
      form_id: isDbForm ? form.id : null,
      registration_target,
      has_email: Boolean(contact_email),
    },
  });

  // In-app notificatie naar tenant-admins. Idempotent via Sprint 65
  // dedup-index met source-key `intake_submission_created` +
  // sourceRef = submission_id. Best-effort.
  void sendNotification({
    tenantId: tenant.id,
    title: "Nieuwe intake-aanvraag",
    contentText: `${contact_name ?? "Een aanvrager"} heeft een ${form.name} ingediend.`,
    targets: [{ target_type: "role", target_id: "tenant_admin" }],
    sendEmail: false,
    sendPush: false,
    source: "intake_submission_created",
    sourceRef: submissionId,
    createdBy: null,
  }).catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[intake] send notification failed:", e);
  });

  return { ok: true, data: { submissionId } };
}
