"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { sendNotification } from "@/lib/notifications/send-notification";

/**
 * Sprint 73 — Status-transities op `intake_submissions`.
 *
 * Lifecycle: submitted → in_review → needs_review → waitlisted →
 * placed → rejected → converted. `placeSubmission` (placements.ts)
 * zet zelf status='placed'; deze module dekt de overige transities.
 *
 * Iedere actie:
 *   1. valideert tenant-access op de submission
 *   2. valideert dat de from-status een geldige bron is voor de
 *      gewenste to-status (geen `placed → submitted`)
 *   3. update status + (optioneel) selected_stage_id
 *   4. logt een audit-event met meta `{from_status, to_status,
 *      reason?, ...}` zodat triage-tijden meetbaar worden.
 */

type TerminalStatus = "placed" | "rejected" | "converted";
const TERMINAL_STATUSES: TerminalStatus[] = ["placed", "rejected", "converted"];

const transitionInput = z.object({
  submissionId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

const updateStageInput = z.object({
  submissionId: z.string().uuid(),
  stageId: z.string().uuid().nullable(),
});

export type TransitionInput = z.infer<typeof transitionInput>;
export type UpdateStageInput = z.infer<typeof updateStageInput>;

export interface TransitionResult {
  ok: boolean;
  error?: string;
}

interface SubmissionRow {
  id: string;
  tenant_id: string;
  status: string;
  program_id: string | null;
}

async function loadSubmission(submissionId: string): Promise<SubmissionRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_submissions")
    .select("id, tenant_id, status, program_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as SubmissionRow;
}

function isTerminal(status: string): status is TerminalStatus {
  return (TERMINAL_STATUSES as string[]).includes(status);
}

async function applyTransition(params: {
  submissionId: string;
  toStatus: "in_review" | "needs_review" | "waitlisted" | "rejected";
  allowedFrom: string[];
  auditAction: string;
  reason?: string;
}): Promise<TransitionResult> {
  const sub = await loadSubmission(params.submissionId);
  if (!sub) return { ok: false, error: "submission niet gevonden" };
  const user = await assertTenantAccess(sub.tenant_id);

  if (isTerminal(sub.status)) {
    return {
      ok: false,
      error: `submission is al ${sub.status} en kan niet worden teruggezet`,
    };
  }
  if (!params.allowedFrom.includes(sub.status)) {
    return {
      ok: false,
      error: `overgang ${sub.status} → ${params.toStatus} is niet toegestaan`,
    };
  }

  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from("intake_submissions")
    .update({ status: params.toStatus })
    .eq("id", params.submissionId)
    .eq("tenant_id", sub.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  const meta: Record<string, string | number | boolean | null> = {
    submission_id: params.submissionId,
    from_status: sub.status,
    to_status: params.toStatus,
  };
  if (params.reason) meta.reason = params.reason;

  await recordAudit({
    tenant_id: sub.tenant_id,
    actor_user_id: user.id,
    action: params.auditAction,
    meta,
  });

  revalidatePath("/tenant/intake");
  revalidatePath(`/tenant/intake/${params.submissionId}`);
  return { ok: true };
}

export async function markSubmissionInReview(
  input: TransitionInput,
): Promise<TransitionResult> {
  const parsed = transitionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  return applyTransition({
    submissionId: parsed.data.submissionId,
    toStatus: "in_review",
    allowedFrom: ["submitted", "needs_review", "waitlisted"],
    auditAction: "intake.submission.reviewed",
    reason: parsed.data.reason,
  });
}

export async function markSubmissionNeedsReview(
  input: TransitionInput,
): Promise<TransitionResult> {
  const parsed = transitionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  const result = await applyTransition({
    submissionId: parsed.data.submissionId,
    toStatus: "needs_review",
    allowedFrom: ["submitted", "in_review", "waitlisted"],
    auditAction: "intake.submission.status_changed",
    reason: parsed.data.reason,
  });
  if (!result.ok) return result;

  // Sprint 73 review-fix: óók bij handmatige transitie naar
  // needs_review wordt een tenant-admin-notificatie verzonden,
  // idempotent via de dedup-key `intake_submission_needs_review`
  // + sourceRef = submission_id (zelfde key als submitIntake).
  const sub = await loadSubmission(parsed.data.submissionId);
  if (sub) {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("intake_submissions")
      .select("contact_name")
      .eq("id", parsed.data.submissionId)
      .maybeSingle();
    const contactName =
      (row as { contact_name: string | null } | null)?.contact_name ??
      "Een aanvrager";
    const reasonSuffix = parsed.data.reason ? ` — ${parsed.data.reason}` : "";
    void sendNotification({
      tenantId: sub.tenant_id,
      title: "Intake vereist beoordeling",
      contentText: `${contactName}${reasonSuffix}`,
      targets: [{ target_type: "role", target_id: "tenant_admin" }],
      sendEmail: false,
      sendPush: false,
      source: "intake_submission_needs_review",
      sourceRef: parsed.data.submissionId,
      createdBy: null,
    }).catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[intake] needs_review tenant-notification failed:", e);
    });
  }
  return result;
}

export async function markSubmissionWaitlisted(
  input: TransitionInput,
): Promise<TransitionResult> {
  const parsed = transitionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  return applyTransition({
    submissionId: parsed.data.submissionId,
    toStatus: "waitlisted",
    allowedFrom: ["submitted", "in_review", "needs_review"],
    auditAction: "intake.submission.status_changed",
    reason: parsed.data.reason,
  });
}

export async function rejectSubmission(
  input: TransitionInput,
): Promise<TransitionResult> {
  const parsed = transitionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  return applyTransition({
    submissionId: parsed.data.submissionId,
    toStatus: "rejected",
    allowedFrom: ["submitted", "in_review", "needs_review", "waitlisted"],
    auditAction: "intake.submission.rejected",
    reason: parsed.data.reason,
  });
}

/**
 * Wijzig de door admin gekozen stage. `null` = stage-keuze terugnemen.
 * Valideert dat de stage tot dezelfde tenant behoort en niet
 * gearchiveerd is. Geen status-wijziging.
 */
export async function updateSelectedStage(
  input: UpdateStageInput,
): Promise<TransitionResult> {
  const parsed = updateStageInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  const { submissionId, stageId } = parsed.data;

  const sub = await loadSubmission(submissionId);
  if (!sub) return { ok: false, error: "submission niet gevonden" };
  const user = await assertTenantAccess(sub.tenant_id);

  const admin = createAdminClient();
  let stageName: string | null = null;
  if (stageId) {
    const { data: stage, error } = await admin
      .from("program_stages")
      .select("id, name, tenant_id, program_id, archived_at")
      .eq("id", stageId)
      .maybeSingle();
    if (error || !stage) return { ok: false, error: "stage niet gevonden" };
    if (stage.tenant_id !== sub.tenant_id) {
      return { ok: false, error: "stage hoort niet bij deze tenant" };
    }
    if (stage.archived_at) {
      return { ok: false, error: "stage is gearchiveerd" };
    }
    // Sprint 73 review-fix: stage moet bij hetzelfde programma horen
    // als de submission. Voorkomt cross-program stage-assignment via
    // een crafted payload (bv. wel tenant-match maar ander programma).
    // Submissions zonder program_id mogen géén stage krijgen — stages
    // bestaan alleen binnen een programma.
    if (!sub.program_id) {
      return { ok: false, error: "submission heeft geen programma" };
    }
    if (stage.program_id !== sub.program_id) {
      return { ok: false, error: "stage hoort niet bij dit programma" };
    }
    stageName = (stage.name as string) ?? null;
  }

  const { error: updErr } = await admin
    .from("intake_submissions")
    .update({ selected_stage_id: stageId })
    .eq("id", submissionId)
    .eq("tenant_id", sub.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    tenant_id: sub.tenant_id,
    actor_user_id: user.id,
    action: "intake.submission.stage_selected",
    meta: {
      submission_id: submissionId,
      stage_id: stageId,
      stage_name: stageName,
    },
  });

  revalidatePath(`/tenant/intake/${submissionId}`);
  return { ok: true };
}
