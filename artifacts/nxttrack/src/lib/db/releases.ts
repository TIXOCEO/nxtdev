import { createClient } from "@/lib/supabase/server";
import type { ReleaseBody, ReleaseStatus, ReleaseType } from "@/lib/validation/release";

export interface PlatformRelease {
  id: string;
  version: string;
  release_type: ReleaseType;
  title: string;
  summary: string;
  body_json: ReleaseBody;
  status: ReleaseStatus;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeBody(raw: unknown): ReleaseBody {
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    new: arr(r.new),
    improved: arr(r.improved),
    fixed: arr(r.fixed),
    admin: arr(r.admin),
  };
}

function toRelease(row: Record<string, unknown>): PlatformRelease {
  return {
    id: row.id as string,
    version: row.version as string,
    release_type: row.release_type as ReleaseType,
    title: row.title as string,
    summary: row.summary as string,
    body_json: normalizeBody(row.body_json),
    status: row.status as ReleaseStatus,
    published_at: (row.published_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Sort versions semver-descending (newest first). */
function compareSemverDesc(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
  }
  return 0;
}

export async function getAllReleases(): Promise<PlatformRelease[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_releases")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch releases: ${error.message}`);
  return (data ?? []).map(toRelease);
}

export async function getPublishedReleases(): Promise<PlatformRelease[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_releases")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to fetch published releases: ${error.message}`);
  const rows = (data ?? []).map(toRelease);
  // Tie-break by semver desc when published_at gelijk is.
  rows.sort((a, b) => {
    const ad = a.published_at ? Date.parse(a.published_at) : 0;
    const bd = b.published_at ? Date.parse(b.published_at) : 0;
    if (ad !== bd) return bd - ad;
    return compareSemverDesc(a.version, b.version);
  });
  return rows;
}

export async function getReleaseById(id: string): Promise<PlatformRelease | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_releases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch release: ${error.message}`);
  return data ? toRelease(data) : null;
}

export async function getReleaseByVersion(version: string): Promise<PlatformRelease | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_releases")
    .select("*")
    .eq("version", version)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch release: ${error.message}`);
  return data ? toRelease(data) : null;
}

export async function getLatestPublishedRelease(): Promise<PlatformRelease | null> {
  const all = await getPublishedReleases();
  return all[0] ?? null;
}

/**
 * Heeft de gebruiker deze release-versie al als gezien gemarkeerd?
 * Gebruikt RLS — een user kan enkel zijn eigen rij lezen.
 */
export async function hasUserSeenRelease(
  userId: string,
  version: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("release_reads")
    .select("version")
    .eq("user_id", userId)
    .eq("version", version)
    .maybeSingle();
  if (error) {
    // Falen we, dan tonen we de "nieuw"-indicator liever onterecht dan de
    // request te crashen.
    return false;
  }
  return !!data;
}

/**
 * Geef de subset van `versions` terug die de gebruiker al heeft gezien.
 * Eén query; bij fouten geven we een lege set terug zodat de UI eerder
 * "nieuw" toont dan de pagina te crashen.
 */
export async function getSeenReleaseVersions(
  userId: string,
  versions: string[],
): Promise<Set<string>> {
  if (versions.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("release_reads")
    .select("version")
    .eq("user_id", userId)
    .in("version", versions);
  if (error) return new Set();
  return new Set((data ?? []).map((row) => (row as { version: string }).version));
}

/**
 * Markeer een release als gezien voor de huidige gebruiker. Idempotent;
 * een tweede bezoek aan dezelfde versie houdt de oorspronkelijke `seen_at`.
 */
export async function markReleaseSeen(
  userId: string,
  version: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("release_reads")
    .upsert(
      { user_id: userId, version },
      { onConflict: "user_id,version", ignoreDuplicates: true },
    );
  if (error) {
    // Niet fataal — de UI valt simpelweg terug op "nieuw" — maar wel zichtbaar
    // in server logs zodat een ontbrekende migratie of RLS-fout opvalt.
    // eslint-disable-next-line no-console
    console.error("[releases] markReleaseSeen failed", {
      userId,
      version,
      message: error.message,
      code: (error as { code?: string }).code,
    });
  }
}
