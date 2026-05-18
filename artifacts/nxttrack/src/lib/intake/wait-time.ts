import type { SupabaseClient } from "@supabase/supabase-js";

export type WaitTone = "green" | "yellow" | "red";

export function toneForWaitWeeks(weeks: number | null | undefined): WaitTone {
  if (weeks == null || weeks <= 2) return "green";
  if (weeks <= 8) return "yellow";
  return "red";
}

export function labelForWaitWeeks(weeks: number | null | undefined): string {
  if (weeks == null) return "Wachttijd onbekend";
  if (weeks === 0) return "Direct plek";
  if (weeks === 1) return "± 1 week wachttijd";
  return `± ${weeks} weken wachttijd`;
}

interface EstimateRow {
  group_id: string;
  stage_id: string | null;
  open_slots: number;
  current_waitlist_count: number;
  estimated_wait_weeks: number;
}

/**
 * Sprint 82 — Haal wachttijdschatting op voor één (group, stage)-combinatie
 * uit view `program_group_waitlist_estimate`. View doet `if open_slots>0
 * then 0 else least(52, greatest(0, waitlist_count*4))`.
 */
export async function getWaitEstimate(
  admin: SupabaseClient,
  params: { tenantId: string; groupId: string; stageId: string | null },
): Promise<number | null> {
  const q = admin
    .from("program_group_waitlist_estimate")
    .select(
      "group_id, stage_id, open_slots, current_waitlist_count, estimated_wait_weeks",
    )
    .eq("tenant_id", params.tenantId)
    .eq("group_id", params.groupId)
    .limit(1);
  const { data } = params.stageId
    ? await q.eq("stage_id", params.stageId)
    : await q.is("stage_id", null);
  const row = (data?.[0] as EstimateRow | undefined) ?? null;
  return row?.estimated_wait_weeks ?? null;
}
