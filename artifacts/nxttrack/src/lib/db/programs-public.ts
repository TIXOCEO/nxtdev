import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bucketWaitlistPressure,
  type WaitlistBucket,
} from "@/lib/programs/bucket-waitlist";

/**
 * Sprint 63 — Publieke marketplace-helpers voor programma's.
 * Sprint 75 — Uitgebreid met wachtrij-indicator (bucket + label).
 *
 * Queries scopen ALTIJD expliciet op tenant_id (defense-in-depth
 * naast de RLS-policy `programs_public_read`) en filteren op
 * visibility='public' + public_slug not null.
 *
 * Indicator-data wordt via de admin-client gelezen (de views joinen
 * onder de motorkap met training_sessions / waitlist_entries /
 * intake_submissions; daar heeft anon geen RLS-policy op). Veilig
 * omdat de views alleen aggregaat-counts blootleggen — geen PII —
 * en we expliciet filteren op de program_id's van publieke programma's.
 */

export interface PublicProgramRow {
  id: string;
  tenant_id: string;
  public_slug: string;
  name: string;
  marketing_title: string | null;
  marketing_description: string | null;
  hero_image_url: string | null;
  cta_label: string | null;
  age_min: number | null;
  age_max: number | null;
  highlights_json: string[];
  sort_order: number;
  use_stages: boolean;
  waitlist_threshold_low: number | null;
  waitlist_threshold_high: number | null;
  expected_wait_label: string | null;
}

export interface PublicProgramWithIndicator extends PublicProgramRow {
  bucket: WaitlistBucket;
}

export interface StageIndicatorRow {
  stage_id: string;
  stage_name: string;
  stage_color: string | null;
  stage_sort_order: number;
  waiting_count: number;
  available_seats: number;
  bucket: WaitlistBucket;
}

const PUBLIC_PROGRAM_COLUMNS =
  "id, tenant_id, public_slug, name, marketing_title, marketing_description, hero_image_url, cta_label, age_min, age_max, highlights_json, sort_order, use_stages, waitlist_threshold_low, waitlist_threshold_high, expected_wait_label";

function normalize(row: Record<string, unknown>): PublicProgramRow {
  const raw = row.highlights_json;
  const highlights: string[] = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    public_slug: row.public_slug as string,
    name: row.name as string,
    marketing_title: (row.marketing_title as string | null) ?? null,
    marketing_description: (row.marketing_description as string | null) ?? null,
    hero_image_url: (row.hero_image_url as string | null) ?? null,
    cta_label: (row.cta_label as string | null) ?? null,
    age_min: (row.age_min as number | null) ?? null,
    age_max: (row.age_max as number | null) ?? null,
    highlights_json: highlights,
    sort_order: (row.sort_order as number) ?? 0,
    use_stages: Boolean(row.use_stages),
    waitlist_threshold_low: (row.waitlist_threshold_low as number | null) ?? null,
    waitlist_threshold_high: (row.waitlist_threshold_high as number | null) ?? null,
    expected_wait_label: (row.expected_wait_label as string | null) ?? null,
  };
}

interface IndicatorRow {
  program_id: string;
  waiting_count: number;
  available_seats: number;
}

async function fetchIndicators(
  tenantId: string,
  programIds: string[],
): Promise<Map<string, IndicatorRow>> {
  if (programIds.length === 0) return new Map();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("program_waitlist_indicator")
    .select("program_id, waiting_count, available_seats")
    .eq("tenant_id", tenantId)
    .in("program_id", programIds);
  const map = new Map<string, IndicatorRow>();
  if (error || !data) return map;
  for (const r of data as Array<{
    program_id: string;
    waiting_count: number | null;
    available_seats: number | null;
  }>) {
    map.set(r.program_id, {
      program_id: r.program_id,
      waiting_count: r.waiting_count ?? 0,
      available_seats: r.available_seats ?? 0,
    });
  }
  return map;
}

/** Lijst publieke programma's met wachtrij-indicator (bucket). */
export async function listPublicMarketplaceProgramsWithIndicator(
  tenantId: string,
): Promise<PublicProgramWithIndicator[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select(PUBLIC_PROGRAM_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("visibility", "public")
    .not("public_slug", "is", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error)
    throw new Error(`listPublicMarketplaceProgramsWithIndicator: ${error.message}`);
  const programs = (data ?? []).map((r) => normalize(r as Record<string, unknown>));
  const indicators = await fetchIndicators(
    tenantId,
    programs.map((p) => p.id),
  );
  return programs.map((p) => {
    const ind = indicators.get(p.id);
    const bucket = bucketWaitlistPressure({
      waitingCount: ind?.waiting_count ?? 0,
      availableSeats: ind?.available_seats ?? 0,
      thresholdLow: p.waitlist_threshold_low,
      thresholdHigh: p.waitlist_threshold_high,
    });
    return { ...p, bucket };
  });
}

/** Lijst publieke programma's, gesorteerd op sort_order, naam (zonder indicator). */
export async function listPublicMarketplacePrograms(
  tenantId: string,
): Promise<PublicProgramRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select(PUBLIC_PROGRAM_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("visibility", "public")
    .not("public_slug", "is", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listPublicMarketplacePrograms: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

/** Goedkope count voor sidebar-conditional. */
export async function countPublicMarketplacePrograms(
  tenantId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("programs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("visibility", "public")
    .not("public_slug", "is", null);
  if (error) return 0;
  return count ?? 0;
}

/** Detail-lookup per (tenant, public_slug). */
export async function getPublicProgramBySlug(
  tenantId: string,
  publicSlug: string,
): Promise<PublicProgramRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select(PUBLIC_PROGRAM_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("visibility", "public")
    .eq("public_slug", publicSlug)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data as Record<string, unknown>);
}

/**
 * Sprint 75 — Geaggregeerde wachtrij-indicator voor 1 programma
 * (gebruikt op de detailpagina). Retourneert null bij read-error.
 */
export async function getProgramWaitlistIndicator(
  tenantId: string,
  programId: string,
): Promise<{ waiting_count: number; available_seats: number } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("program_waitlist_indicator")
    .select("waiting_count, available_seats")
    .eq("tenant_id", tenantId)
    .eq("program_id", programId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { waiting_count: number | null; available_seats: number | null };
  return {
    waiting_count: row.waiting_count ?? 0,
    available_seats: row.available_seats ?? 0,
  };
}

/**
 * Sprint 75 — Per-stage indicator-rijen voor de detail-pagina.
 * Gesorteerd op `stage_sort_order, stage_name`. Lege array bij fout.
 */
export async function listProgramStageIndicators(
  tenantId: string,
  programId: string,
  thresholdLow: number | null,
  thresholdHigh: number | null,
): Promise<StageIndicatorRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("program_waitlist_indicator_by_stage")
    .select(
      "stage_id, stage_name, stage_color, stage_sort_order, waiting_count, available_seats",
    )
    .eq("tenant_id", tenantId)
    .eq("program_id", programId)
    .order("stage_sort_order", { ascending: true })
    .order("stage_name", { ascending: true });
  if (error || !data) return [];
  return (data as Array<{
    stage_id: string;
    stage_name: string;
    stage_color: string | null;
    stage_sort_order: number;
    waiting_count: number | null;
    available_seats: number | null;
  }>).map((r) => {
    const waiting = r.waiting_count ?? 0;
    const available = r.available_seats ?? 0;
    return {
      stage_id: r.stage_id,
      stage_name: r.stage_name,
      stage_color: r.stage_color,
      stage_sort_order: r.stage_sort_order,
      waiting_count: waiting,
      available_seats: available,
      bucket: bucketWaitlistPressure({
        waitingCount: waiting,
        availableSeats: available,
        thresholdLow,
        thresholdHigh,
      }),
    };
  });
}
