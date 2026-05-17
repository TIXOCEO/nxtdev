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
import { recommendStage } from "@/lib/intake/recommend-stage";
import { needsReview } from "@/lib/intake/needs-review";

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

  // Sprint 72 — lookup recommended_stage_id wanneer een programma + een
  // niveau-voorkeur aanwezig is. Case-insensitive naam-match binnen
  // het programma. Geen exception bij geen match — gewoon null laten.
  //
  // Sprint 73 — fallback: als de directe `preferred_level`-match niets
  // oplevert, vraag de pure rule-engine om een aanbeveling per sector
  // (zwemschool: ervaring/drijven/onder-water; voetbal: leeftijd).
  let recommendedStageId: string | null = null;
  let recommendedStageName: string | null = null;
  const preferredLevel =
    typeof cleaned["preferred_level"] === "string"
      ? (cleaned["preferred_level"] as string).trim().toLowerCase()
      : null;
  const programIdFromAnswers =
    typeof cleaned["program_id"] === "string" ? (cleaned["program_id"] as string) : null;

  let programStages: Array<{ id: string; name: string }> = [];
  if (programIdFromAnswers) {
    const { data: stageRow } = await admin
      .from("program_stages")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("program_id", programIdFromAnswers)
      .is("archived_at", null);
    programStages = (stageRow ?? []) as Array<{ id: string; name: string }>;
  }

  if (preferredLevel && programStages.length > 0) {
    const match = programStages.find(
      (s) => s.name.trim().toLowerCase() === preferredLevel,
    );
    if (match) {
      recommendedStageId = match.id;
      recommendedStageName = match.name;
    }
  }

  // Sprint 73 — sector-rule fallback.
  const ruleResult = recommendStage({
    sectorTemplateKey: tenant.sector_template_key,
    dateOfBirth: contact_dob,
    preferences: cleaned,
  });
  if (!recommendedStageId && ruleResult.stageName && programStages.length > 0) {
    const target = ruleResult.stageName.trim().toLowerCase();
    const match = programStages.find(
      (s) => s.name.trim().toLowerCase() === target,
    );
    if (match) {
      recommendedStageId = match.id;
      recommendedStageName = match.name;
    }
  }
  if (!recommendedStageName) recommendedStageName = ruleResult.stageName;

  // Sprint 73 — needs_review-heuristiek + program-validatie. We
  // valideren tegelijk dat het opgegeven program_id tot deze tenant
  // behoort; pas dan persisteren we het op de submission-rij zodat
  // downstream stage/placement-logica geen aannames hoeft te doen.
  let programAgeMin: number | null = null;
  let programAgeMax: number | null = null;
  let validatedProgramId: string | null = null;
  if (programIdFromAnswers) {
    const { data: prog } = await admin
      .from("programs")
      .select("id, age_min, age_max")
      .eq("tenant_id", tenant.id)
      .eq("id", programIdFromAnswers)
      .maybeSingle();
    if (prog) {
      validatedProgramId = (prog as { id: string }).id;
      programAgeMin = (prog as { age_min: number | null }).age_min ?? null;
      programAgeMax = (prog as { age_max: number | null }).age_max ?? null;
    }
  }
  const review = needsReview({
    sectorTemplateKey: tenant.sector_template_key,
    dateOfBirth: contact_dob,
    preferences: cleaned,
    programAgeMin,
    programAgeMax,
    recommendedStageId,
  });
  const initialStatus: "submitted" | "needs_review" = review.needs
    ? "needs_review"
    : "submitted";

  const { data: subRow, error: subErr } = await admin
    .from("intake_submissions")
    .insert({
      tenant_id: tenant.id,
      form_id: isDbForm ? form.id : null,
      submission_type: form.submission_type,
      status: initialStatus,
      registration_target,
      contact_name,
      contact_email,
      contact_phone,
      contact_date_of_birth: contact_dob,
      agreed_terms: Boolean(cleaned["agreed_terms"]),
      preferences_json: cleaned,
      program_id: validatedProgramId,
      recommended_stage_id: recommendedStageId,
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

  // Sprint 73 — extra notificatie wanneer de submission automatisch op
  // `needs_review` is gezet, idempotent via dedup-key
  // `intake_submission_needs_review` + sourceRef = submission_id.
  if (initialStatus === "needs_review") {
    void sendNotification({
      tenantId: tenant.id,
      title: "Intake vereist beoordeling",
      contentText:
        `${contact_name ?? "Een aanvrager"} — ${review.reasons.join("; ")}`,
      targets: [{ target_type: "role", target_id: "tenant_admin" }],
      sendEmail: false,
      sendPush: false,
      source: "intake_submission_needs_review",
      sourceRef: submissionId,
      createdBy: null,
    }).catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[intake] needs_review notification failed:", e);
    });
  }

  return { ok: true, data: { submissionId } };
}
