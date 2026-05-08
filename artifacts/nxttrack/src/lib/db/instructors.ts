import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface InstructorRow {
  member_id: string;
  full_name: string;
  email: string | null;
  trainer_role_label: string | null;
  upcoming_sessions: number;
}

/**
 * Lijst van instructeurs (members met trainer-rol) binnen de tenant,
 * inclusief #upcoming session-toewijzingen via `session_instructors_effective`.
 */
export async function listInstructors(tenantId: string): Promise<InstructorRow[]> {
  const admin = createAdminClient();

  // Trainer via member_roles.role='trainer'
  const { data: memberRoleTrainers } = await admin
    .from("member_roles")
    .select("member_id, members!inner(id,tenant_id,full_name,email,archived_at)")
    .eq("role", "trainer");
  // Trainer via tenant_member_roles + tenant_roles.is_trainer_role
  const { data: tmrTrainers } = await admin
    .from("tenant_member_roles")
    .select("member_id, tenant_roles!inner(name,is_trainer_role), members!inner(id,tenant_id,full_name,email,archived_at)")
    .eq("tenant_id", tenantId);

  type MaybeArray<T> = T | T[] | null;
  function flat<T>(v: MaybeArray<T>): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  }

  const map = new Map<string, InstructorRow>();
  for (const r of (memberRoleTrainers ?? []) as Array<{
    member_id: string;
    members: MaybeArray<{ id: string; tenant_id: string; full_name: string; email: string | null; archived_at: string | null }>;
  }>) {
    const m = flat(r.members);
    if (!m || m.tenant_id !== tenantId || m.archived_at) continue;
    if (!map.has(m.id)) {
      map.set(m.id, { member_id: m.id, full_name: m.full_name, email: m.email, trainer_role_label: "trainer", upcoming_sessions: 0 });
    }
  }
  for (const r of (tmrTrainers ?? []) as Array<{
    member_id: string;
    tenant_roles: MaybeArray<{ name: string; is_trainer_role: boolean }>;
    members: MaybeArray<{ id: string; tenant_id: string; full_name: string; email: string | null; archived_at: string | null }>;
  }>) {
    const m = flat(r.members);
    const tr = flat(r.tenant_roles);
    if (!m || !tr || !tr.is_trainer_role || m.archived_at) continue;
    const existing = map.get(m.id);
    if (existing) {
      if (!existing.trainer_role_label) existing.trainer_role_label = tr.name;
    } else {
      map.set(m.id, { member_id: m.id, full_name: m.full_name, email: m.email, trainer_role_label: tr.name, upcoming_sessions: 0 });
    }
  }

  const memberIds = Array.from(map.keys());
  if (memberIds.length === 0) return [];

  // Count upcoming sessions per instructor via the effective view.
  const nowIso = new Date().toISOString();
  const { data: upcoming } = await admin
    .from("session_instructors_effective")
    .select("member_id, training_sessions!inner(starts_at,status)")
    .eq("tenant_id", tenantId)
    .in("member_id", memberIds);

  for (const r of (upcoming ?? []) as Array<{
    member_id: string;
    training_sessions: MaybeArray<{ starts_at: string; status: string }>;
  }>) {
    const ts = flat(r.training_sessions);
    if (!ts) continue;
    if (ts.status === "cancelled") continue;
    if (ts.starts_at < nowIso) continue;
    const row = map.get(r.member_id);
    if (row) row.upcoming_sessions++;
  }

  return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name, "nl"));
}

export interface AvailabilityRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  availability_type: "available" | "preferred" | "unavailable";
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
}

export async function listAvailability(tenantId: string, memberId: string): Promise<AvailabilityRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("instructor_availability")
    .select("id, day_of_week, start_time, end_time, availability_type, valid_from, valid_until, notes")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  return (data ?? []) as AvailabilityRow[];
}

export interface UnavailabilityRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  notes: string | null;
}

export async function listUnavailability(
  tenantId: string,
  memberId: string,
  fromIso?: string,
): Promise<UnavailabilityRow[]> {
  const admin = createAdminClient();
  let q = admin
    .from("instructor_unavailability")
    .select("id, starts_at, ends_at, reason, notes")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId)
    .order("starts_at", { ascending: true });
  if (fromIso) q = q.gte("ends_at", fromIso);
  const { data } = await q;
  return (data ?? []) as UnavailabilityRow[];
}

export interface InstructorSessionRow {
  session_id: string;
  starts_at: string;
  ends_at: string;
  title: string;
  group_id: string;
  group_name: string;
  assignment_type: "primary" | "assistant" | "substitute" | "observer";
  is_explicit: boolean;
}

export async function listInstructorSessions(
  tenantId: string,
  memberId: string,
  opts: { fromIso?: string; toIso?: string } = {},
): Promise<InstructorSessionRow[]> {
  const admin = createAdminClient();
  type MaybeArray<T> = T | T[] | null;
  const { data } = await admin
    .from("session_instructors_effective")
    .select("session_id, member_id, assignment_type, is_explicit, training_sessions!inner(id,starts_at,ends_at,title,group_id,groups!inner(id,name))")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId);
  function flat<T>(v: MaybeArray<T>): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  }
  const rows: InstructorSessionRow[] = [];
  for (const r of (data ?? []) as Array<{
    session_id: string;
    assignment_type: InstructorSessionRow["assignment_type"];
    is_explicit: boolean;
    training_sessions: MaybeArray<{
      starts_at: string; ends_at: string; title: string; group_id: string;
      groups: MaybeArray<{ id: string; name: string }>;
    }>;
  }>) {
    const ts = flat(r.training_sessions);
    if (!ts) continue;
    const g = flat(ts.groups);
    if (opts.fromIso && ts.starts_at < opts.fromIso) continue;
    if (opts.toIso && ts.starts_at > opts.toIso) continue;
    rows.push({
      session_id: r.session_id,
      starts_at: ts.starts_at,
      ends_at: ts.ends_at,
      title: ts.title,
      group_id: ts.group_id,
      group_name: g?.name ?? "—",
      assignment_type: r.assignment_type,
      is_explicit: r.is_explicit,
    });
  }
  return rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export interface SessionInstructorRow {
  id: string;
  member_id: string;
  full_name: string;
  assignment_type: "primary" | "assistant" | "substitute" | "observer";
  replaces_member_id: string | null;
  replaces_member_name: string | null;
  assigned_at: string;
  is_explicit: boolean;
}

export async function listSessionInstructorsExplicit(
  tenantId: string,
  sessionId: string,
): Promise<SessionInstructorRow[]> {
  const admin = createAdminClient();
  type MaybeArray<T> = T | T[] | null;
  const { data } = await admin
    .from("session_instructors")
    .select("id, member_id, assignment_type, replaces_member_id, assigned_at, members!inner(id,full_name)")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId)
    .order("assigned_at", { ascending: true });
  function flat<T>(v: MaybeArray<T>): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  }
  const rows = (data ?? []) as Array<{
    id: string; member_id: string; assignment_type: SessionInstructorRow["assignment_type"];
    replaces_member_id: string | null; assigned_at: string;
    members: MaybeArray<{ id: string; full_name: string }>;
  }>;
  const replacesIds = rows.map((r) => r.replaces_member_id).filter((v): v is string => Boolean(v));
  const replacesMap = new Map<string, string>();
  if (replacesIds.length > 0) {
    const { data: rep } = await admin
      .from("members").select("id,full_name").in("id", replacesIds);
    for (const m of (rep ?? []) as Array<{ id: string; full_name: string }>) {
      replacesMap.set(m.id, m.full_name);
    }
  }
  return rows.map((r) => {
    const m = flat(r.members);
    return {
      id: r.id,
      member_id: r.member_id,
      full_name: m?.full_name ?? "—",
      assignment_type: r.assignment_type,
      replaces_member_id: r.replaces_member_id,
      replaces_member_name: r.replaces_member_id ? (replacesMap.get(r.replaces_member_id) ?? null) : null,
      assigned_at: r.assigned_at,
      is_explicit: true,
    };
  });
}

export interface SessionEffectiveInstructorRow {
  session_id: string;
  member_id: string;
  full_name: string;
  assignment_type: "primary" | "assistant" | "substitute" | "observer";
  is_explicit: boolean;
}

export async function listSessionInstructorsEffective(
  tenantId: string,
  sessionId: string,
): Promise<SessionEffectiveInstructorRow[]> {
  const supabase = await createClient();
  type MaybeArray<T> = T | T[] | null;
  const { data } = await supabase
    .from("session_instructors_effective")
    .select("session_id, member_id, assignment_type, is_explicit, members!inner(id,full_name)")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId);
  function flat<T>(v: MaybeArray<T>): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  }
  return ((data ?? []) as Array<{
    session_id: string; member_id: string; assignment_type: SessionEffectiveInstructorRow["assignment_type"];
    is_explicit: boolean;
    members: MaybeArray<{ id: string; full_name: string }>;
  }>).map((r) => ({
    session_id: r.session_id,
    member_id: r.member_id,
    full_name: flat(r.members)?.full_name ?? "—",
    assignment_type: r.assignment_type,
    is_explicit: r.is_explicit,
  }));
}

export interface ConflictRow {
  conflict_kind: "overlap" | "unavailable_block" | "not_available_weekly" | "understaffed";
  session_id: string;
  session_starts_at: string;
  session_ends_at: string;
  member_id: string | null;
  detail: string;
  session_title: string | null;
  member_full_name: string | null;
}

export async function detectConflicts(
  tenantId: string,
  fromIso: string,
  toIso: string,
): Promise<ConflictRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("detect_instructor_conflicts", {
    p_tenant_id: tenantId,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) throw new Error(`detect_instructor_conflicts: ${error.message}`);
  const raw = (data ?? []) as Array<Omit<ConflictRow, "session_title" | "member_full_name">>;
  if (raw.length === 0) return [];

  const sessionIds = Array.from(new Set(raw.map((r) => r.session_id)));
  const memberIds = Array.from(new Set(raw.map((r) => r.member_id).filter((v): v is string => Boolean(v))));

  const [{ data: sessions }, { data: members }] = await Promise.all([
    admin.from("training_sessions").select("id,title").in("id", sessionIds),
    memberIds.length > 0
      ? admin.from("members").select("id,full_name").in("id", memberIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);
  const sMap = new Map((sessions ?? []).map((s: { id: string; title: string }) => [s.id, s.title]));
  const mMap = new Map((members ?? []).map((m: { id: string; full_name: string }) => [m.id, m.full_name]));

  return raw.map((r) => ({
    ...r,
    session_title: sMap.get(r.session_id) ?? null,
    member_full_name: r.member_id ? (mMap.get(r.member_id) ?? null) : null,
  }));
}

export interface UnderstaffedRow {
  session_id: string;
  starts_at: string;
  ends_at: string;
  title: string;
  group_id: string;
  group_name: string;
  need: number;
  have: number;
}

/**
 * Lijst van sessies die te weinig primary-instructeurs hebben.
 * Gebruikt de RPC + filtert op understaffed.
 */
export async function listUnderstaffed(
  tenantId: string,
  fromIso: string,
  toIso: string,
): Promise<UnderstaffedRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("detect_instructor_conflicts", {
    p_tenant_id: tenantId,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) throw new Error(error.message);
  const raw = (data ?? []) as Array<{ conflict_kind: string; session_id: string; detail: string }>;
  const understaffed = raw.filter((r) => r.conflict_kind === "understaffed");
  if (understaffed.length === 0) return [];
  type MaybeArray<T> = T | T[] | null;
  const { data: sessions } = await admin
    .from("training_sessions")
    .select("id,starts_at,ends_at,title,group_id,groups!inner(id,name)")
    .in("id", understaffed.map((u) => u.session_id));
  function flat<T>(v: MaybeArray<T>): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  }
  const sMap = new Map(((sessions ?? []) as Array<{
    id: string; starts_at: string; ends_at: string; title: string; group_id: string;
    groups: MaybeArray<{ id: string; name: string }>;
  }>).map((s) => [s.id, { ...s, group_name: flat(s.groups)?.name ?? "—" }]));
  return understaffed.flatMap((u) => {
    const s = sMap.get(u.session_id);
    if (!s) return [];
    // detail looks like "need=2 have=1"
    const m = u.detail.match(/need=(\d+) have=(\d+)/);
    return [{
      session_id: u.session_id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      title: s.title,
      group_id: s.group_id,
      group_name: s.group_name,
      need: m ? Number(m[1]) : 0,
      have: m ? Number(m[2]) : 0,
    }];
  }).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function getInstructorMember(
  tenantId: string,
  memberId: string,
): Promise<{ id: string; full_name: string; email: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("id, full_name, email")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  // Vereis trainer-rol om dit als instructeur-detail te tonen.
  const [{ data: directRole }, { data: tenantRole }] = await Promise.all([
    admin.from("member_roles").select("member_id").eq("member_id", memberId).eq("role", "trainer").limit(1).maybeSingle(),
    admin.from("tenant_member_roles").select("member_id, tenant_roles!inner(is_trainer_role)").eq("tenant_id", tenantId).eq("member_id", memberId).eq("tenant_roles.is_trainer_role", true).limit(1).maybeSingle(),
  ]);
  if (!directRole && !tenantRole) return null;
  return data as { id: string; full_name: string; email: string | null };
}

export interface MemberGroupRow {
  group_id: string;
  group_name: string;
  is_trainer_in_group: boolean;
  member_count: number;
}

/**
 * Lijst van groepen waarin deze member als group_member staat. We labelen
 * de rol via member_roles (trainer-rol = is_trainer_in_group=true).
 */
export async function listMemberGroups(
  tenantId: string,
  memberId: string,
): Promise<MemberGroupRow[]> {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("group_members")
    .select("group_id, groups!inner(id,name,tenant_id)")
    .eq("member_id", memberId);
  type LinkRow = { group_id: string; groups: { id: string; name: string; tenant_id: string } | { id: string; name: string; tenant_id: string }[] | null };
  const rows = ((links ?? []) as LinkRow[])
    .map((l) => {
      const g = Array.isArray(l.groups) ? (l.groups[0] ?? null) : l.groups;
      return g && g.tenant_id === tenantId ? { group_id: l.group_id, name: g.name } : null;
    })
    .filter((x): x is { group_id: string; name: string } => x !== null);
  if (rows.length === 0) return [];
  const groupIds = rows.map((r) => r.group_id);

  // member-counts per group
  const { data: counts } = await admin
    .from("group_members")
    .select("group_id")
    .in("group_id", groupIds);
  const countMap = new Map<string, number>();
  for (const c of (counts ?? []) as Array<{ group_id: string }>) {
    countMap.set(c.group_id, (countMap.get(c.group_id) ?? 0) + 1);
  }

  // trainer-rol via member_roles OF custom tenant_roles.is_trainer_role=true
  const [{ data: directRole }, { data: tenantRole }] = await Promise.all([
    admin
      .from("member_roles")
      .select("member_id")
      .eq("member_id", memberId)
      .eq("role", "trainer")
      .limit(1)
      .maybeSingle(),
    admin
      .from("tenant_member_roles")
      .select("member_id, tenant_roles!inner(is_trainer_role)")
      .eq("tenant_id", tenantId)
      .eq("member_id", memberId)
      .eq("tenant_roles.is_trainer_role", true)
      .limit(1)
      .maybeSingle(),
  ]);
  const isTrainer = Boolean(directRole) || Boolean(tenantRole);

  return rows
    .map((r) => ({
      group_id: r.group_id,
      group_name: r.name,
      is_trainer_in_group: isTrainer,
      member_count: countMap.get(r.group_id) ?? 0,
    }))
    .sort((a, b) => a.group_name.localeCompare(b.group_name, "nl"));
}
