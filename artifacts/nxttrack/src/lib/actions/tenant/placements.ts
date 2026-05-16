"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";

/**
 * Sprint 70 — Plaats een intake-submission in een groep.
 *
 * Advisory placement-assistent levert (group_id, rank, score). De
 * admin klikt "Plaats hier" en deze actie:
 *   1. valideert tenant-access op submission + group
 *   2. zet status='placed' + assigned_group_id (+ reviewed_by/at)
 *   3. logt `intake.submission.placed` met suggestion_rank/score
 *      zodat we later kunnen meten of admins suggesties opvolgen
 *
 * Suggestion-meta is optioneel: de actie is ook bruikbaar voor
 * handmatige plaatsing zonder suggestie-context.
 */

const placeSchema = z.object({
  submissionId: z.string().uuid(),
  groupId: z.string().uuid(),
  suggestionRank: z.number().int().min(1).max(50).optional(),
  suggestionScore: z.number().min(0).max(100).optional(),
});

export type PlaceSubmissionInput = z.infer<typeof placeSchema>;

export interface PlaceSubmissionResult {
  ok: boolean;
  error?: string;
}

export async function placeSubmission(
  input: PlaceSubmissionInput,
): Promise<PlaceSubmissionResult> {
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "ongeldige invoer" };
  }
  const { submissionId, groupId, suggestionRank, suggestionScore } = parsed.data;

  const admin = createAdminClient();

  const { data: sub, error: subErr } = await admin
    .from("intake_submissions")
    .select("id, tenant_id, status")
    .eq("id", submissionId)
    .maybeSingle();
  if (subErr || !sub) return { ok: false, error: "submission niet gevonden" };

  const user = await assertTenantAccess(sub.tenant_id);

  const { data: grp, error: grpErr } = await admin
    .from("groups")
    .select("id, tenant_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (grpErr || !grp) return { ok: false, error: "groep niet gevonden" };
  if (grp.tenant_id !== sub.tenant_id) {
    return { ok: false, error: "groep hoort niet bij deze tenant" };
  }

  const { error: updErr } = await admin
    .from("intake_submissions")
    .update({
      status: "placed",
      assigned_group_id: groupId,
    })
    .eq("id", submissionId)
    .eq("tenant_id", sub.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  const meta: Record<string, string | number | boolean | null> = {
    group_id: groupId,
    group_name: grp.name ?? null,
  };
  if (typeof suggestionRank === "number") meta.suggestion_rank = suggestionRank;
  if (typeof suggestionScore === "number") meta.suggestion_score = suggestionScore;

  await recordAudit({
    tenant_id: sub.tenant_id,
    actor_user_id: user.id,
    action: "intake.submission.placed",
    meta,
  });

  revalidatePath("/tenant/intake");
  revalidatePath(`/tenant/intake/${submissionId}`);
  return { ok: true };
}
