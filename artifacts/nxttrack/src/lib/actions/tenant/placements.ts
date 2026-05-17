"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { placeSubmissionCore } from "@/lib/intake/place-submission-core";

/**
 * Sprint 70 — Plaats een intake-submission in een groep.
 *
 * Sprint 74 — Kern-logica is uitgelicht naar `placeSubmissionCore`
 * zodat ook de publieke slot-offer-accept-flow dezelfde lifecycle-,
 * audit- en top5-statistiek-pad gebruikt.
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
    .select("id, tenant_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (subErr || !sub) return { ok: false, error: "submission niet gevonden" };

  const user = await assertTenantAccess(sub.tenant_id);

  const res = await placeSubmissionCore({
    submissionId,
    groupId,
    tenantId: sub.tenant_id,
    actorUserId: user.id,
    suggestionRank,
    suggestionScore,
  });
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/tenant/intake");
  revalidatePath(`/tenant/intake/${submissionId}`);
  return { ok: true };
}
