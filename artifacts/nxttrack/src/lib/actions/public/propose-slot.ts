"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit/log";
import { sendNotification } from "@/lib/notifications/send-notification";
import { sendEmail } from "@/lib/email/send-email";
import { hashReviewToken } from "@/lib/intake/review-token";
import { appBaseUrl } from "@/lib/url";
import { scorePlacementCandidatesPublic } from "@/lib/db/placement";
import { getWaitEstimate } from "@/lib/intake/wait-time";

/**
 * Sprint 82 — Publieke server-actions voor de "kies-je-tijdsblok"-flow.
 *
 *  - resolveSubmissionByReviewToken: laadt submission via plain token
 *    (sha256-hash match + niet-verlopen).
 *  - chooseProposedSlot: maakt een `intake_slot_offers`-rij aan met
 *    48u TTL voor de gekozen groep en geeft het slot-token terug zodat
 *    de aanvrager direct naar /intake-slot/<token>/accept kan.
 *  - confirmWaitlistChoice: parent kiest expliciet voor wachtlijst.
 *  - cancelSubmissionChoice: parent annuleert de aanvraag.
 *
 * Geen `assertTenantAccess` — autoriteit is het review-token zelf.
 */

const PROPOSE_SLOT_TTL_HOURS = 48;

interface SubmissionLookup {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  form_id: string | null;
}

export async function resolveSubmissionByReviewToken(
  plainToken: string,
): Promise<SubmissionLookup | null> {
  if (!plainToken || typeof plainToken !== "string") return null;
  const hash = hashReviewToken(plainToken);
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("intake_submissions")
    .select(
      "id, tenant_id, status, contact_name, contact_email, form_id, review_token_expires_at",
    )
    .eq("review_token_hash", hash)
    .maybeSingle();
  if (!sub) return null;
  const exp = (sub as { review_token_expires_at: string | null })
    .review_token_expires_at;
  if (!exp || new Date(exp).getTime() < Date.now()) return null;
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", (sub as { tenant_id: string }).tenant_id)
    .maybeSingle();
  if (!tenantRow) return null;
  return {
    id: (sub as { id: string }).id,
    tenant_id: (sub as { tenant_id: string }).tenant_id,
    tenant_slug: (tenantRow as { slug: string }).slug,
    status: (sub as { status: string }).status,
    contact_name: (sub as { contact_name: string | null }).contact_name,
    contact_email: (sub as { contact_email: string | null }).contact_email,
    form_id: (sub as { form_id: string | null }).form_id,
  };
}

export interface ChooseProposedSlotInput {
  reviewToken: string;
  groupId: string;
  sessionId?: string | null;
  suggestionRank?: number | null;
  suggestionScore?: number | null;
}

export type ProposeActionResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

export async function chooseProposedSlot(
  input: ChooseProposedSlotInput,
): Promise<ProposeActionResult> {
  const sub = await resolveSubmissionByReviewToken(input.reviewToken);
  if (!sub) return { ok: false, error: "Deze link is niet langer geldig." };
  if (
    !["submitted", "in_review", "needs_review", "waitlisted"].includes(
      sub.status,
    )
  ) {
    return {
      ok: false,
      error: `Aanvraag is al ${sub.status} — kies een andere actie.`,
    };
  }
  if (!input.groupId) return { ok: false, error: "Ongeldige keuze." };

  // Constrain naar top-3 server-side: voorkomt dat een aanvrager een
  // willekeurige tenant-groep kiest die niet in de oorspronkelijke
  // voorstellen voorkwam. Gebruikt de token-authorized publieke RPC zodat
  // anon-callers ook bij scoring kunnen.
  //
  // Sprint 82b post-review fix: zelfde ordering-pipeline als in
  // /voorstellen — enrich top-12 met wachttijd, sorteer op (capaciteit >
  // wachttijd > score), pas dán top-3. Anders kan input.groupId wel in
  // de score-top3 zitten maar niet in de wachttijd-gesorteerde top-3 die
  // de aanvrager op het scherm zag, of vice versa.
  const candidates = await scorePlacementCandidatesPublic(sub.id, input.reviewToken);
  const adminEarly = createAdminClient();
  type Enriched = { group_id: string; capacity_match: number; total_score: number; wait_weeks: number | null };
  const enriched: Enriched[] = [];
  for (const c of candidates.slice(0, 12)) {
    const stageId = c.rationale_json.target_stage_id ?? null;
    const wait = await getWaitEstimate(adminEarly, {
      tenantId: sub.tenant_id,
      groupId: c.group_id,
      stageId,
    });
    enriched.push({
      group_id: c.group_id,
      capacity_match: c.capacity_match,
      total_score: c.total_score,
      wait_weeks: wait,
    });
  }
  enriched.sort((a, b) => {
    const capDiff = (b.capacity_match > 0 ? 1 : 0) - (a.capacity_match > 0 ? 1 : 0);
    if (capDiff !== 0) return capDiff;
    const wA = a.wait_weeks ?? 99;
    const wB = b.wait_weeks ?? 99;
    if (wA !== wB) return wA - wB;
    return b.total_score - a.total_score;
  });
  const top3Ids = new Set(enriched.slice(0, 3).map((c) => c.group_id));
  if (!top3Ids.has(input.groupId)) {
    return { ok: false, error: "Deze groep zit niet in jouw voorstellen." };
  }

  const admin = createAdminClient();
  const { data: grp } = await admin
    .from("groups")
    .select("id, tenant_id, name")
    .eq("id", input.groupId)
    .maybeSingle();
  if (!grp || (grp as { tenant_id: string }).tenant_id !== sub.tenant_id) {
    return { ok: false, error: "Groep niet gevonden." };
  }

  const expiresAt = new Date(
    Date.now() + PROPOSE_SLOT_TTL_HOURS * 3600 * 1000,
  ).toISOString();
  const { data: offer, error: insErr } = await admin
    .from("intake_slot_offers")
    .insert({
      tenant_id: sub.tenant_id,
      submission_id: sub.id,
      group_id: input.groupId,
      session_id: input.sessionId ?? null,
      status: "pending",
      expires_at: expiresAt,
      suggestion_rank: input.suggestionRank ?? null,
      suggestion_score: input.suggestionScore ?? null,
      created_by: null,
    })
    .select("id, token")
    .single();
  if (insErr || !offer) {
    return {
      ok: false,
      error: insErr?.message ?? "Kon je keuze niet vastleggen.",
    };
  }

  await admin
    .from("intake_submissions")
    .update({ review_token_hash: null, review_token_expires_at: null })
    .eq("id", sub.id)
    .eq("tenant_id", sub.tenant_id);

  await recordAudit({
    tenant_id: sub.tenant_id,
    actor_user_id: "00000000-0000-0000-0000-000000000000",
    action: "intake.slot_offer.created",
    meta: {
      submission_id: sub.id,
      group_id: input.groupId,
      group_name: (grp as { name: string | null }).name ?? null,
      offer_id: (offer as { id: string }).id,
      expires_at: expiresAt,
      source: "public_propose_slots",
      ...(typeof input.suggestionRank === "number"
        ? { suggestion_rank: input.suggestionRank }
        : {}),
      ...(typeof input.suggestionScore === "number"
        ? { suggestion_score: input.suggestionScore }
        : {}),
    },
  });

  void sendNotification({
    tenantId: sub.tenant_id,
    title: "Aanvrager koos een tijdsblok",
    contentText: `${sub.contact_name ?? "Een aanvrager"} heeft zelf een tijdsblok gekozen (${(grp as { name: string | null }).name ?? "groep"}).`,
    targets: [{ target_type: "role", target_id: "tenant_admin" }],
    sendEmail: false,
    sendPush: false,
    source: "intake_slot_offered",
    sourceRef: (offer as { id: string }).id,
    createdBy: null,
  }).catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[propose-slot] notification failed:", e);
  });

  const redirectUrl = `${appBaseUrl()}/intake-slot/${(offer as { token: string }).token}/accept`;
  return { ok: true, redirectUrl };
}

export async function confirmWaitlistChoice(input: {
  reviewToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sub = await resolveSubmissionByReviewToken(input.reviewToken);
  if (!sub) return { ok: false, error: "Deze link is niet langer geldig." };
  if (sub.status === "waitlisted") {
    return { ok: true };
  }
  if (!["submitted", "in_review", "needs_review"].includes(sub.status)) {
    return { ok: false, error: `Aanvraag is al ${sub.status}.` };
  }

  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from("intake_submissions")
    .update({
      status: "waitlisted",
      review_token_hash: null,
      review_token_expires_at: null,
    })
    .eq("id", sub.id)
    .eq("tenant_id", sub.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    tenant_id: sub.tenant_id,
    actor_user_id: "00000000-0000-0000-0000-000000000000",
    action: "intake.submission.waitlist_confirmed",
    meta: { submission_id: sub.id, source: "public_propose_slots" },
  });

  if (sub.contact_email) {
    void sendEmail({
      tenantId: sub.tenant_id,
      templateKey: "intake_waitlisted",
      to: sub.contact_email,
      triggerSource: "intake.waitlist_confirmed",
      variables: { contact_name: sub.contact_name ?? "" },
    }).catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[propose-slot] waitlist email failed:", e);
    });
  }

  void sendNotification({
    tenantId: sub.tenant_id,
    title: "Aanvrager koos wachtlijst",
    contentText: `${sub.contact_name ?? "Een aanvrager"} ging akkoord met de wachtlijst.`,
    targets: [{ target_type: "role", target_id: "tenant_admin" }],
    sendEmail: false,
    sendPush: false,
    source: "intake_submission_auto_waitlisted",
    sourceRef: sub.id,
    createdBy: null,
  }).catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[propose-slot] waitlist notification failed:", e);
  });

  return { ok: true };
}

export async function cancelSubmissionChoice(input: {
  reviewToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sub = await resolveSubmissionByReviewToken(input.reviewToken);
  if (!sub) return { ok: false, error: "Deze link is niet langer geldig." };
  if (sub.status === "rejected") return { ok: true };
  if (!["submitted", "in_review", "needs_review", "waitlisted"].includes(sub.status)) {
    return { ok: false, error: `Aanvraag is al ${sub.status}.` };
  }

  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from("intake_submissions")
    .update({
      status: "rejected",
      review_token_hash: null,
      review_token_expires_at: null,
    })
    .eq("id", sub.id)
    .eq("tenant_id", sub.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    tenant_id: sub.tenant_id,
    actor_user_id: "00000000-0000-0000-0000-000000000000",
    action: "intake.submission.cancelled_by_applicant",
    meta: { submission_id: sub.id, source: "public_propose_slots" },
  });

  return { ok: true };
}
