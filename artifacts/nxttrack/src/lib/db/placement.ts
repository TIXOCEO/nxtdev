import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Sprint 70 — Wrapper voor RPC `score_placement_candidates`.
 *
 * Returnt een ranked array (hoogste total_score eerst). Lege RPC-
 * output is geen error — de UI toont dan een lege-state.
 */

export interface PlacementCandidate {
  group_id: string;
  session_id: string | null;
  total_score: number;
  capacity_match: number;
  time_pref_match: number;
  location_pref_match: number;
  age_match: number;
  level_match: number;
  free_seats: number;
  rationale_json: {
    capacity?: string;
    time?: string;
    location?: string;
    age?: string;
    level?: string;
    [key: string]: string | undefined;
  };
}

export async function scorePlacementCandidates(
  submissionId: string,
): Promise<PlacementCandidate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("score_placement_candidates", {
    p_submission_id: submissionId,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[placement] rpc failed:", error.message);
    // Sprint 71 — gooi i.p.v. lege array terug zodat callers het verschil
    // zien tussen "geen kandidaten" (lege array) en "scoring faalde"
    // (exception). Belangrijk voor audit-meta `top5_max_score`: bij een
    // exception moeten we 0 NIET als zwakke match loggen.
    throw new Error(`score_placement_candidates failed: ${error.message}`);
  }
  if (!Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    group_id: String(row.group_id),
    session_id: (row.session_id as string | null) ?? null,
    total_score: Number(row.total_score ?? 0),
    capacity_match: Number(row.capacity_match ?? 0),
    time_pref_match: Number(row.time_pref_match ?? 0),
    location_pref_match: Number(row.location_pref_match ?? 0),
    age_match: Number(row.age_match ?? 0),
    level_match: Number(row.level_match ?? 0),
    free_seats: Number(row.free_seats ?? 0),
    rationale_json: (row.rationale_json as PlacementCandidate["rationale_json"]) ?? {},
  }));
}
