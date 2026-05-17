import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit/log";
import { scorePlacementCandidates } from "@/lib/db/placement";

/**
 * Sprint 74 — Gedeelde plaatsings-core voor `placeSubmission` (admin-
 * action met `assertTenantAccess`) én de publieke token-flow van
 * `respondToSlotOffer` (geen auth — token is het bewijs).
 *
 * De caller is verantwoordelijk voor authenticatie/autorisatie; deze
 * functie doet alleen defense-in-depth lifecycle- en tenant-match-
 * checks. Geeft hetzelfde resultaat-shape terug zodat beide paden
 * dezelfde error-messages kunnen tonen.
 */

export interface PlaceSubmissionCoreInput {
  submissionId: string;
  groupId: string;
  tenantId: string;
  /** UUID van de uitvoerende admin, óf het sentinel-id voor token-flows. */
  actorUserId: string;
  suggestionRank?: number;
  suggestionScore?: number;
  viaSlotOffer?: boolean;
  slotOfferId?: string;
}

export interface PlaceSubmissionCoreResult {
  ok: boolean;
  error?: string;
  fromStatus?: string;
}

const ALLOWED_FROM: readonly string[] = [
  "submitted",
  "in_review",
  "needs_review",
  "waitlisted",
];

export async function placeSubmissionCore(
  input: PlaceSubmissionCoreInput,
): Promise<PlaceSubmissionCoreResult> {
  const admin = createAdminClient();

  const { data: sub, error: subErr } = await admin
    .from("intake_submissions")
    .select("id, tenant_id, status")
    .eq("id", input.submissionId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (subErr || !sub) return { ok: false, error: "submission niet gevonden" };

  if (!ALLOWED_FROM.includes(sub.status)) {
    return {
      ok: false,
      error: `overgang ${sub.status} → placed is niet toegestaan`,
      fromStatus: sub.status,
    };
  }
  const fromStatus = sub.status;

  const { data: grp, error: grpErr } = await admin
    .from("groups")
    .select("id, tenant_id, name")
    .eq("id", input.groupId)
    .maybeSingle();
  if (grpErr || !grp) return { ok: false, error: "groep niet gevonden" };
  if (grp.tenant_id !== input.tenantId) {
    return { ok: false, error: "groep hoort niet bij deze tenant" };
  }

  const { error: updErr } = await admin
    .from("intake_submissions")
    .update({
      status: "placed",
      assigned_group_id: input.groupId,
    })
    .eq("id", input.submissionId)
    .eq("tenant_id", input.tenantId);
  if (updErr) return { ok: false, error: updErr.message };

  // Capture top5_max_score (Sprint 71-pattern). Best-effort: een
  // RPC-fout mag het audit-event niet blokkeren.
  let top5MaxScore: number | null = null;
  try {
    const candidates = await scorePlacementCandidates(input.submissionId);
    if (candidates.length > 0) {
      const top5 = candidates.slice(0, 5);
      top5MaxScore = Math.max(...top5.map((c) => Number(c.total_score ?? 0)));
    } else {
      top5MaxScore = 0;
    }
  } catch {
    top5MaxScore = null;
  }

  const meta: Record<string, string | number | boolean | null> = {
    submission_id: input.submissionId,
    group_id: input.groupId,
    group_name: grp.name ?? null,
    from_status: fromStatus,
    to_status: "placed",
  };
  if (typeof input.suggestionRank === "number")
    meta.suggestion_rank = input.suggestionRank;
  if (typeof input.suggestionScore === "number")
    meta.suggestion_score = input.suggestionScore;
  if (top5MaxScore != null) meta.top5_max_score = top5MaxScore;
  if (input.viaSlotOffer) meta.via_slot_offer = true;
  if (input.slotOfferId) meta.slot_offer_id = input.slotOfferId;

  await recordAudit({
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId,
    action: "intake.submission.placed",
    meta,
  });

  return { ok: true, fromStatus };
}
