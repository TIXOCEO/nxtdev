import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashReviewToken } from "@/lib/intake/review-token";

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
    /** Sprint 72 — namen van stages waaraan deze groep gekoppeld is. */
    group_stage_names?: string[];
    /** Sprint 72 — de stage die als doel werd gebruikt voor level-match. */
    target_stage_name?: string | null;
    /** Sprint 72 — hex-kleur van de target-stage, voor badge-rendering. */
    target_stage_color?: string | null;
    /** Sprint 82b — UUID van de target-stage (alleen door publieke RPC gevuld). */
    target_stage_id?: string | null;
    [key: string]: string | string[] | null | undefined;
  };
}

function normalizeCandidate(row: Record<string, unknown>): PlacementCandidate {
  return {
    group_id: String(row.group_id),
    session_id: (row.session_id as string | null) ?? null,
    total_score: Number(row.total_score ?? 0),
    capacity_match: Number(row.capacity_match ?? 0),
    time_pref_match: Number(row.time_pref_match ?? 0),
    location_pref_match: Number(row.location_pref_match ?? 0),
    age_match: Number(row.age_match ?? 0),
    level_match: Number(row.level_match ?? 0),
    free_seats: Number(row.free_seats ?? 0),
    rationale_json:
      (row.rationale_json as PlacementCandidate["rationale_json"]) ?? {},
  };
}

/**
 * Sprint 82b — Token-authorized variant voor de publieke /voorstellen-flow.
 *
 * Roept de RPC `score_placement_candidates_public` aan met een sha256-hash
 * van het review-token. RPC valideert dat het hash matcht en niet verlopen
 * is — autoriteit is dus het token, niet `auth.uid()`. Granted aan `anon`
 * + `authenticated`. Gebruikt admin-client zodat geen anon-JWT nodig is
 * (de RPC doet zijn eigen authz).
 */
export async function scorePlacementCandidatesPublic(
  submissionId: string,
  plainReviewToken: string,
): Promise<PlacementCandidate[]> {
  if (!plainReviewToken) {
    throw new Error("review_token_required");
  }
  const tokenHash = hashReviewToken(plainReviewToken);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("score_placement_candidates_public", {
    p_submission_id: submissionId,
    p_token_hash: tokenHash,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[placement] public rpc failed:", error.message);
    throw new Error(`score_placement_candidates_public failed: ${error.message}`);
  }
  if (!Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => normalizeCandidate(row));
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
  return data.map((row: Record<string, unknown>) => normalizeCandidate(row));
}
