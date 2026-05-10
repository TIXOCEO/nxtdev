import { createClient } from "@/lib/supabase/server";

export type ProgramVisibility = "public" | "internal" | "archived";

export interface ProgramRow {
  id: string;
  tenant_id: string;
  slug: string;
  public_slug: string | null;
  name: string;
  marketing_title: string | null;
  marketing_description: string | null;
  hero_image_url: string | null;
  cta_label: string | null;
  visibility: ProgramVisibility;
  default_capacity: number | null;
  default_flex_capacity: number | null;
  default_min_instructors: number;
  capacity_purpose_defaults_json: Record<string, unknown>;
  age_min: number | null;
  age_max: number | null;
  highlights_json: unknown[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProgramListRow extends ProgramRow {
  group_count: number;
}

const PROGRAM_COLUMNS =
  "id, tenant_id, slug, public_slug, name, marketing_title, marketing_description, hero_image_url, cta_label, visibility, default_capacity, default_flex_capacity, default_min_instructors, capacity_purpose_defaults_json, age_min, age_max, highlights_json, sort_order, created_at, updated_at";

/**
 * Lijst van programma's voor een tenant, inclusief # gekoppelde groepen.
 * Sortering: sort_order asc → name asc.
 */
export async function listProgramsPage(tenantId: string): Promise<ProgramListRow[]> {
  const supabase = await createClient();
  const { data: programs, error } = await supabase
    .from("programs")
    .select(PROGRAM_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listProgramsPage: ${error.message}`);

  const rows = (programs ?? []) as ProgramRow[];
  if (rows.length === 0) return [];

  const { data: links } = await supabase
    .from("program_groups")
    .select("program_id")
    .eq("tenant_id", tenantId)
    .in("program_id", rows.map((r) => r.id));

  const counts = new Map<string, number>();
  for (const l of (links ?? []) as Array<{ program_id: string }>) {
    counts.set(l.program_id, (counts.get(l.program_id) ?? 0) + 1);
  }

  return rows.map((r) => ({ ...r, group_count: counts.get(r.id) ?? 0 }));
}

export async function getProgramById(
  tenantId: string,
  programId: string,
): Promise<ProgramRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select(PROGRAM_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", programId)
    .maybeSingle();
  if (error) throw new Error(`getProgramById: ${error.message}`);
  return (data as ProgramRow | null) ?? null;
}

export interface ProgramGroupRow {
  group_id: string;
  group_name: string;
  is_primary: boolean;
  member_count: number;
  sort_order: number;
}

export async function listProgramGroups(
  tenantId: string,
  programId: string,
): Promise<ProgramGroupRow[]> {
  const supabase = await createClient();
  type MaybeArray<T> = T | T[] | null;
  const { data, error } = await supabase
    .from("program_groups")
    .select("group_id, is_primary, sort_order, groups!inner(id, name, tenant_id)")
    .eq("tenant_id", tenantId)
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`listProgramGroups: ${error.message}`);

  function flat<T>(v: MaybeArray<T>): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  }
  const rows = ((data ?? []) as Array<{
    group_id: string;
    is_primary: boolean;
    sort_order: number;
    groups: MaybeArray<{ id: string; name: string; tenant_id: string }>;
  }>)
    .map((r) => {
      const g = flat(r.groups);
      if (!g || g.tenant_id !== tenantId) return null;
      return { group_id: r.group_id, group_name: g.name, is_primary: r.is_primary, sort_order: r.sort_order };
    })
    .filter((x): x is { group_id: string; group_name: string; is_primary: boolean; sort_order: number } => x !== null);

  if (rows.length === 0) return rows.map((r) => ({ ...r, member_count: 0 }));

  const { data: counts } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", rows.map((r) => r.group_id));
  const cMap = new Map<string, number>();
  for (const c of (counts ?? []) as Array<{ group_id: string }>) {
    cMap.set(c.group_id, (cMap.get(c.group_id) ?? 0) + 1);
  }
  return rows
    .map((r) => ({ ...r, member_count: cMap.get(r.group_id) ?? 0 }))
    .sort((a, b) => a.sort_order - b.sort_order || a.group_name.localeCompare(b.group_name, "nl"));
}

export interface AvailableGroupRow {
  id: string;
  name: string;
  member_count: number;
}

/**
 * Lijst van groepen binnen de tenant die nog NIET aan dit program zijn
 * gekoppeld — voor de "groep koppelen"-picker op de detail-page.
 */
export async function listAvailableGroupsForProgram(
  tenantId: string,
  programId: string,
): Promise<AvailableGroupRow[]> {
  const supabase = await createClient();
  const [{ data: groups, error: gErr }, { data: linked }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true }),
    supabase
      .from("program_groups")
      .select("group_id")
      .eq("tenant_id", tenantId)
      .eq("program_id", programId),
  ]);
  if (gErr) throw new Error(`listAvailableGroupsForProgram: ${gErr.message}`);
  const linkedSet = new Set(((linked ?? []) as Array<{ group_id: string }>).map((l) => l.group_id));
  const candidates = ((groups ?? []) as Array<{ id: string; name: string }>).filter(
    (g) => !linkedSet.has(g.id),
  );
  if (candidates.length === 0) return [];

  const { data: counts } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", candidates.map((g) => g.id));
  const cMap = new Map<string, number>();
  for (const c of (counts ?? []) as Array<{ group_id: string }>) {
    cMap.set(c.group_id, (cMap.get(c.group_id) ?? 0) + 1);
  }
  return candidates.map((g) => ({ id: g.id, name: g.name, member_count: cMap.get(g.id) ?? 0 }));
}
