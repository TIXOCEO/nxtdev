import { createClient } from "@/lib/supabase/server";
import type { Group, Member, MemberRole } from "@/types/database";

export interface GroupWithCount extends Group {
  member_count: number;
  /** Sprint 42 — hoeveel leden hebben de rol "trainer". */
  trainer_count: number;
}

export async function getGroupsByTenant(tenantId: string): Promise<GroupWithCount[]> {
  const supabase = await createClient();

  const [{ data: groups, error: gErr }, { data: links }] = await Promise.all([
    supabase
      .from("groups")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true }),
    supabase
      .from("group_members")
      .select("group_id, member_id, groups!inner(tenant_id)")
      .eq("groups.tenant_id", tenantId),
  ]);

  if (gErr) throw new Error(`Failed to fetch groups: ${gErr.message}`);

  const counts = new Map<string, number>();
  const memberIds = new Set<string>();
  const linksByGroup = new Map<string, string[]>();
  for (const l of (links ?? []) as Array<{ group_id: string; member_id: string }>) {
    counts.set(l.group_id, (counts.get(l.group_id) ?? 0) + 1);
    memberIds.add(l.member_id);
    const arr = linksByGroup.get(l.group_id) ?? [];
    arr.push(l.member_id);
    linksByGroup.set(l.group_id, arr);
  }

  const trainerIds = new Set<string>();
  if (memberIds.size > 0) {
    const { data: roleRows } = await supabase
      .from("member_roles")
      .select("member_id, role")
      .in("member_id", Array.from(memberIds))
      .eq("role", "trainer");
    for (const r of (roleRows ?? []) as Array<{ member_id: string }>) {
      trainerIds.add(r.member_id);
    }
  }

  return ((groups ?? []) as Group[]).map((g) => {
    const memberList = linksByGroup.get(g.id) ?? [];
    const trainerCount = memberList.filter((id) => trainerIds.has(id)).length;
    return {
      ...g,
      member_count: counts.get(g.id) ?? 0,
      trainer_count: trainerCount,
    };
  });
}

// ── Sprint 42 — paginated groups list ─────────────────────────

export type GroupSortKey = "name" | "member_count" | "trainer_count" | "updated_at";
export type SortOrder = "asc" | "desc";

export interface GetGroupsPageOptions {
  search?: string | null;
  sortBy?: GroupSortKey;
  sortOrder?: SortOrder;
  offset?: number;
  limit?: number;
}

export interface GetGroupsPageResult {
  rows: GroupWithCount[];
  total: number;
}

/**
 * Paginated, filtered list of groups for the overview page.
 *
 * We doen filter+sort in Postgres voor naam en updated_at via PostgREST.
 * Voor `member_count` / `trainer_count` valt PostgREST tekort — die kunnen
 * we niet zonder server-side aggregate sorteren. We berekenen die counts
 * dus altijd in JS en sorteren in JS wanneer de gebruiker er expliciet om
 * vraagt. Voor een tenant met enkele honderden groepen is dat ruim
 * voldoende; bij grotere tenants kan dit later naar een SQL view.
 */
export async function getGroupsPage(
  tenantId: string,
  opts: GetGroupsPageOptions = {},
): Promise<GetGroupsPageResult> {
  const supabase = await createClient();
  const sortBy: GroupSortKey = opts.sortBy ?? "name";
  const sortOrder: SortOrder = opts.sortOrder ?? "asc";
  const search = (opts.search ?? "").trim();

  // 1. Haal alle relevante group-id's met server-side filter.
  let q = supabase
    .from("groups")
    .select("id")
    .eq("tenant_id", tenantId);
  if (search) {
    const raw = search.replace(/[\\%,()]/g, " ").trim();
    if (raw) {
      const pat = `%${raw}%`;
      q = q.or(`name.ilike.${pat},description.ilike.${pat}`);
    }
  }
  const { data: matchingIds, error: idErr } = await q;
  if (idErr) throw new Error(`Failed to filter groups: ${idErr.message}`);
  const filteredIds = ((matchingIds ?? []) as Array<{ id: string }>).map((r) => r.id);
  const total = filteredIds.length;
  if (total === 0) return { rows: [], total: 0 };

  // 2. Hydrate alle gefilterde groepen volledig + counts.
  const { data: groupRows, error: gErr } = await supabase
    .from("groups")
    .select("*")
    .in("id", filteredIds);
  if (gErr) throw new Error(`Failed to fetch groups: ${gErr.message}`);

  const { data: links } = await supabase
    .from("group_members")
    .select("group_id, member_id")
    .in("group_id", filteredIds);

  const linksByGroup = new Map<string, string[]>();
  const memberIds = new Set<string>();
  for (const l of (links ?? []) as Array<{ group_id: string; member_id: string }>) {
    const arr = linksByGroup.get(l.group_id) ?? [];
    arr.push(l.member_id);
    linksByGroup.set(l.group_id, arr);
    memberIds.add(l.member_id);
  }

  const trainerIds = new Set<string>();
  if (memberIds.size > 0) {
    const { data: roleRows } = await supabase
      .from("member_roles")
      .select("member_id, role")
      .in("member_id", Array.from(memberIds))
      .eq("role", "trainer");
    for (const r of (roleRows ?? []) as Array<{ member_id: string }>) {
      trainerIds.add(r.member_id);
    }
  }

  let hydrated: GroupWithCount[] = ((groupRows ?? []) as Group[]).map((g) => {
    const list = linksByGroup.get(g.id) ?? [];
    return {
      ...g,
      member_count: list.length,
      trainer_count: list.filter((id) => trainerIds.has(id)).length,
    };
  });

  // 3. Sorteer in JS (consistente regels voor alle kolommen).
  const dir = sortOrder === "asc" ? 1 : -1;
  hydrated.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "member_count":
        cmp = a.member_count - b.member_count;
        break;
      case "trainer_count":
        cmp = a.trainer_count - b.trainer_count;
        break;
      case "updated_at":
        cmp = (a.updated_at ?? "").localeCompare(b.updated_at ?? "");
        break;
      case "name":
      default:
        cmp = a.name.localeCompare(b.name, "nl", { sensitivity: "base" });
        break;
    }
    if (cmp === 0) {
      cmp = a.name.localeCompare(b.name, "nl", { sensitivity: "base" });
    }
    return cmp * dir;
  });

  // 4. Paginate in-memory.
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.max(1, opts.limit ?? 25);
  const rows = hydrated.slice(offset, offset + limit);

  return { rows, total };
}

// ── Sprint 42 — paginated/sorted detail rows ──────────────────

export interface GroupDetail {
  group: Group;
  /** Aantal leden — gebruikt voor het max_members badge. */
  member_count: number;
  athletes: Array<Pick<Member, "id" | "full_name" | "member_status"> & { joined_at: string | null }>;
  trainers: Array<Pick<Member, "id" | "full_name" | "member_status"> & { joined_at: string | null }>;
  staff: Array<Pick<Member, "id" | "full_name" | "member_status"> & { joined_at: string | null }>;
  /** All other members in this group not in athletes/trainers/staff buckets. */
  others: Array<Pick<Member, "id" | "full_name" | "member_status"> & { joined_at: string | null }>;
}

export async function getGroupDetail(
  groupId: string,
  tenantId: string,
): Promise<GroupDetail | null> {
  const supabase = await createClient();

  const { data: g } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!g) return null;

  const { data: gm } = await supabase
    .from("group_members")
    .select("member_id, created_at")
    .eq("group_id", groupId);
  const links = (gm ?? []) as Array<{ member_id: string; created_at: string }>;
  const memberIds = links.map((r) => r.member_id);
  const joinedByMember = new Map<string, string>();
  for (const r of links) joinedByMember.set(r.member_id, r.created_at);

  if (memberIds.length === 0) {
    return {
      group: g as Group,
      member_count: 0,
      athletes: [],
      trainers: [],
      staff: [],
      others: [],
    };
  }

  const [{ data: members }, { data: roles }] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, member_status")
      .eq("tenant_id", tenantId)
      .in("id", memberIds)
      .order("full_name", { ascending: true }),
    supabase
      .from("member_roles")
      .select("member_id, role")
      .in("member_id", memberIds),
  ]);

  const rolesByMember = new Map<string, Set<string>>();
  for (const r of (roles ?? []) as Array<MemberRole>) {
    const set = rolesByMember.get(r.member_id) ?? new Set<string>();
    set.add(r.role);
    rolesByMember.set(r.member_id, set);
  }

  const athletes: GroupDetail["athletes"] = [];
  const trainers: GroupDetail["trainers"] = [];
  const staff: GroupDetail["staff"] = [];
  const others: GroupDetail["others"] = [];

  for (const m of (members ?? []) as Array<Pick<Member, "id" | "full_name" | "member_status">>) {
    const set = rolesByMember.get(m.id) ?? new Set<string>();
    const row = { ...m, joined_at: joinedByMember.get(m.id) ?? null };
    if (set.has("trainer")) trainers.push(row);
    else if (set.has("athlete")) athletes.push(row);
    else if (set.has("staff")) staff.push(row);
    else others.push(row);
  }

  return {
    group: g as Group,
    member_count: links.length,
    athletes,
    trainers,
    staff,
    others,
  };
}

// ── Sprint 42 — searchable add-member helper ──────────────────

export interface MemberSearchResult {
  id: string;
  full_name: string;
  email: string | null;
  athlete_code: string | null;
  roles: string[];
}

/**
 * Live-zoek helper voor de "Lid toevoegen"-popover. Matcht (case-insensitive)
 * op `full_name`, `first_name`, `last_name` en `email`. Resultaten worden
 * gefilterd op tenant en optioneel uitgesloten van een groep zodat reeds
 * gekoppelde leden niet opnieuw verschijnen. We laten archived members
 * weg — die kunnen niet aan groepen toegevoegd worden.
 */
export async function searchMembersForGroup(
  tenantId: string,
  query: string,
  opts: { excludeGroupId?: string; limit?: number; roles?: string[] } = {},
): Promise<MemberSearchResult[]> {
  const supabase = await createClient();
  const raw = query.trim().replace(/[\\%,()]/g, " ").trim();
  if (raw.length < 2) return [];
  const pat = `%${raw}%`;
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));

  let q = supabase
    .from("members")
    .select("id, full_name, email, athlete_code")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .or(
      `full_name.ilike.${pat},first_name.ilike.${pat},last_name.ilike.${pat},email.ilike.${pat},athlete_code.ilike.${pat}`,
    )
    .order("full_name", { ascending: true })
    .limit(limit);

  const { data, error } = await q;
  if (error) throw new Error(`Failed to search members: ${error.message}`);

  const rows = (data ?? []) as Array<
    Pick<Member, "id" | "full_name" | "email" | "athlete_code">
  >;
  let candidateIds = rows.map((r) => r.id);

  // Exclude members already in the target group.
  if (opts.excludeGroupId && candidateIds.length > 0) {
    const { data: existing } = await supabase
      .from("group_members")
      .select("member_id")
      .eq("group_id", opts.excludeGroupId)
      .in("member_id", candidateIds);
    const taken = new Set(
      ((existing ?? []) as Array<{ member_id: string }>).map((r) => r.member_id),
    );
    candidateIds = candidateIds.filter((id) => !taken.has(id));
  }

  if (candidateIds.length === 0) return [];

  const { data: roleRows } = await supabase
    .from("member_roles")
    .select("member_id, role")
    .in("member_id", candidateIds);

  const rolesByMember = new Map<string, string[]>();
  for (const r of (roleRows ?? []) as Array<{ member_id: string; role: string }>) {
    const arr = rolesByMember.get(r.member_id) ?? [];
    arr.push(r.role);
    rolesByMember.set(r.member_id, arr);
  }

  const filtered = rows.filter((r) => candidateIds.includes(r.id));
  let result = filtered.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    athlete_code: r.athlete_code,
    roles: rolesByMember.get(r.id) ?? [],
  }));

  if (opts.roles && opts.roles.length > 0) {
    const wanted = new Set(opts.roles);
    result = result.filter((r) => r.roles.some((role) => wanted.has(role)));
  }

  return result;
}
