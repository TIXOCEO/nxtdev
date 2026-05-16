import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sprint 71 — Plaatsings-opvolg-statistieken.
 *
 * Eén consistent cohort: audit_logs-rijen met
 * `action='intake.submission.placed'` binnen het datumbereik
 * (gefilterd op `audit_logs.created_at` = plaatsings-event-datum,
 * NIET op submission-creatie). Alle KPI's worden uit dezelfde
 * rijen afgeleid zodat noemers/tellers altijd kloppen:
 *
 *   - meta->>'suggestion_rank'  (paneel-knop zet dit; manueel niet)
 *   - meta->>'suggestion_score' (idem)
 *   - meta->>'top5_max_score'   (Sprint 71: hoogste score in top-5 op
 *     moment van plaatsing, vastgelegd door placements.ts)
 *   - meta->>'submission_id'    (Sprint 71: linkt audit-rij terug naar
 *     intake_submissions voor tijd-tot-plaatsing-berekening)
 *
 * Voor audit-rijen van vóór Sprint 71 ontbreken `submission_id` en
 * `top5_max_score` — deze worden uit de relevante metrics gestript
 * (de teller, NIET uit de noemer wanneer dat zinvol is — zie code).
 */

export interface PlacementStatsRange {
  from?: string | null;
  to?: string | null;
}

export interface PlacementFollowupStats {
  totalPlacements: number;
  placementsViaPanel: number;
  panelSharePct: number | null;
  avgSuggestionRank: number | null;
  avgSuggestionScore: number | null;
  avgHoursToPlacement: number | null;
  hoursSampleSize: number;
  weakTop5Count: number;
  weakTop5SharePct: number | null;
  weakTop5SampleSize: number;
  rangeFrom: string;
  rangeTo: string;
}

function defaultRange(range: PlacementStatsRange): { from: string; to: string } {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const from = range.from ? `${range.from}T00:00:00Z` : ninetyDaysAgo.toISOString();
  const to = range.to ? `${range.to}T23:59:59Z` : now.toISOString();
  return { from, to };
}

interface AuditMeta {
  submission_id?: string | null;
  suggestion_rank?: number | string | null;
  suggestion_score?: number | string | null;
  top5_max_score?: number | string | null;
}

interface AuditRow {
  created_at: string;
  meta: AuditMeta | null;
}

interface SubmissionLookupRow {
  id: string;
  created_at: string;
}

function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getPlacementFollowupStats(
  tenantId: string,
  range: PlacementStatsRange = {},
): Promise<PlacementFollowupStats> {
  const { from, to } = defaultRange(range);
  const admin = createAdminClient();

  // Sprint 71 — pagineer i.p.v. een hard cap, anders zijn de KPI's
  // onbetrouwbaar voor actieve tenants/langere bereiken. Supabase
  // PostgREST cap'd standaard op 1000 per request, dus we lopen door
  // tot we een korte page krijgen.
  const PAGE_SIZE = 1000;
  const auditRows: AuditRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("audit_logs")
      .select("created_at, meta")
      .eq("tenant_id", tenantId)
      .eq("action", "intake.submission.placed")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        "[placement-stats] audit_logs page failed:",
        error.message,
        { tenantId, offset },
      );
      break;
    }
    const page = (data ?? []) as AuditRow[];
    auditRows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // Verzamel submission_id's om in 1 query terug te linken voor de
  // tijd-tot-plaatsing-berekening (één cohort, één join).
  const submissionIds = Array.from(
    new Set(
      auditRows
        .map((r) => (r.meta?.submission_id ?? null) as string | null)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const submissionCreatedAt: Map<string, number> = new Map();
  // Sprint 71 — batch i.v.m. URL-lengte-limieten van PostgREST `in()`
  // bij grote audit-volumes.
  const ID_BATCH = 200;
  for (let i = 0; i < submissionIds.length; i += ID_BATCH) {
    const chunk = submissionIds.slice(i, i + ID_BATCH);
    const { data, error } = await admin
      .from("intake_submissions")
      .select("id, created_at")
      .eq("tenant_id", tenantId)
      .in("id", chunk);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        "[placement-stats] intake_submissions lookup failed:",
        error.message,
        { tenantId, chunkSize: chunk.length },
      );
      continue;
    }
    const subRows = (data ?? []) as SubmissionLookupRow[];
    for (const s of subRows) {
      const t = Date.parse(s.created_at);
      if (Number.isFinite(t)) submissionCreatedAt.set(s.id, t);
    }
  }

  const totalPlacements = auditRows.length;
  let placementsViaPanel = 0;
  let rankSum = 0;
  let rankCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let hoursSum = 0;
  let hoursCount = 0;
  let weakTop5Count = 0;
  let weakTop5SampleSize = 0;

  for (const row of auditRows) {
    const meta = row.meta ?? {};
    const rank = toFiniteNumber(meta.suggestion_rank);
    const score = toFiniteNumber(meta.suggestion_score);
    const top5Max = toFiniteNumber(meta.top5_max_score);

    if (rank != null) {
      placementsViaPanel += 1;
      rankSum += rank;
      rankCount += 1;
    }
    if (score != null) {
      scoreSum += score;
      scoreCount += 1;
    }
    if (top5Max != null) {
      weakTop5SampleSize += 1;
      if (top5Max <= 20) weakTop5Count += 1;
    }

    const submissionId =
      typeof meta.submission_id === "string" ? meta.submission_id : null;
    if (submissionId) {
      const createdMs = submissionCreatedAt.get(submissionId);
      const placedMs = Date.parse(row.created_at);
      if (
        createdMs != null &&
        Number.isFinite(placedMs) &&
        placedMs >= createdMs
      ) {
        hoursSum += (placedMs - createdMs) / (1000 * 60 * 60);
        hoursCount += 1;
      }
    }
  }

  const panelSharePct =
    totalPlacements > 0
      ? Math.round((placementsViaPanel / totalPlacements) * 1000) / 10
      : null;
  const weakTop5SharePct =
    weakTop5SampleSize > 0
      ? Math.round((weakTop5Count / weakTop5SampleSize) * 1000) / 10
      : null;

  return {
    totalPlacements,
    placementsViaPanel,
    panelSharePct,
    avgSuggestionRank:
      rankCount > 0 ? Math.round((rankSum / rankCount) * 100) / 100 : null,
    avgSuggestionScore:
      scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
    avgHoursToPlacement:
      hoursCount > 0 ? Math.round((hoursSum / hoursCount) * 10) / 10 : null,
    hoursSampleSize: hoursCount,
    weakTop5Count,
    weakTop5SharePct,
    weakTop5SampleSize,
    rangeFrom: from,
    rangeTo: to,
  };
}
