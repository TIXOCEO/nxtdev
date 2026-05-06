import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  TrainingSession,
  TrainingAttendance,
  Group,
  Member,
} from "@/types/database";

export interface TrainingSessionWithGroup extends TrainingSession {
  group: Pick<Group, "id" | "name"> | null;
}

export async function getTrainingSessionsByTenant(
  tenantId: string,
  opts: { upcomingOnly?: boolean } = {},
): Promise<TrainingSessionWithGroup[]> {
  const supabase = await createClient();
  let q = supabase
    .from("training_sessions")
    .select("*, group:groups(id,name)")
    .eq("tenant_id", tenantId)
    .order("starts_at", { ascending: true });
  if (opts.upcomingOnly) {
    q = q.gte("starts_at", new Date().toISOString());
  }
  const { data, error } = await q;
  if (error) throw new Error(`Failed to fetch trainings: ${error.message}`);
  return ((data ?? []) as Array<
    TrainingSession & { group: Group | Group[] | null }
  >).map((r) => ({
    ...r,
    group: Array.isArray(r.group) ? (r.group[0] ?? null) : r.group,
  }));
}

export async function getTrainingSessionDetail(
  sessionId: string,
  tenantId: string,
): Promise<{
  session: TrainingSession;
  group: Pick<Group, "id" | "name"> | null;
  attendance: Array<
    TrainingAttendance & {
      member: Pick<Member, "id" | "full_name"> | null;
    }
  >;
} | null> {
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("training_sessions")
    .select("*, group:groups(id,name)")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!s) return null;

  const session = s as TrainingSession & { group: Group | Group[] | null };
  const group = Array.isArray(session.group)
    ? (session.group[0] ?? null)
    : session.group;

  const { data: a } = await supabase
    .from("training_attendance")
    .select("*, member:members(id,full_name)")
    .eq("session_id", sessionId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  type Row = TrainingAttendance & { member: Member | Member[] | null };
  const attendance = ((a ?? []) as Row[]).map((row) => ({
    ...row,
    member: Array.isArray(row.member) ? (row.member[0] ?? null) : row.member,
  }));

  return { session: session as TrainingSession, group, attendance };
}

/** Sprint 35 — viewer's role inside a particular session. */
export type SessionViewerRole = "athlete" | "trainer";

export interface SessionForUser extends TrainingSessionWithGroup {
  forMembers: Array<Pick<Member, "id" | "full_name">>;
  /** Sprint 35 — trainer when the user is a trainer of this group, else athlete (own/child). */
  viewerRole: SessionViewerRole;
}

/**
 * For the public schedule: sessions visible to a given user.
 *
 * Includes:
 *  - sessions of groups the user (or a linked child) is an athlete in,
 *  - sessions of groups the user is a TRAINER in (member_roles.role='trainer'
 *    or a tenant_role with is_trainer_role=true).
 *
 * Each result carries `viewerRole` so the UI can branch (RSVP vs Manage).
 *
 * Uses the admin client because this spans members/group_members/member_links/
 * member_roles/tenant_member_roles and the caller already authenticated.
 */
export async function getSessionsForUser(
  tenantId: string,
  userId: string,
  opts: { fromIso?: string; toIso?: string; limit?: number } = {},
): Promise<SessionForUser[]> {
  const admin = createAdminClient();

  // Find every member in this tenant relevant to the user (own + children).
  const { data: ownMembers } = await admin
    .from("members")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  const own = ((ownMembers ?? []) as Member[]).map((m) => ({
    id: m.id,
    full_name: m.full_name,
  }));
  const ownIds = own.map((m) => m.id);

  // Trainer member ids: own members carrying role='trainer' OR custom tenant_role with is_trainer_role.
  let trainerMemberIds = new Set<string>();
  if (ownIds.length > 0) {
    const [{ data: roleRows }, { data: tmrRows }] = await Promise.all([
      admin
        .from("member_roles")
        .select("member_id, role")
        .in("member_id", ownIds)
        .eq("role", "trainer"),
      admin
        .from("tenant_member_roles")
        .select("member_id, tenant_roles!inner(is_trainer_role)")
        .eq("tenant_id", tenantId)
        .in("member_id", ownIds),
    ]);
    for (const r of (roleRows ?? []) as Array<{ member_id: string }>) {
      trainerMemberIds.add(r.member_id);
    }
    type TmrRow = {
      member_id: string;
      tenant_roles:
        | { is_trainer_role: boolean }
        | { is_trainer_role: boolean }[]
        | null;
    };
    for (const r of (tmrRows ?? []) as TmrRow[]) {
      const list = Array.isArray(r.tenant_roles)
        ? r.tenant_roles
        : r.tenant_roles
          ? [r.tenant_roles]
          : [];
      if (list.some((tr) => tr.is_trainer_role)) {
        trainerMemberIds.add(r.member_id);
      }
    }
  }

  // Children
  let childMembers: Member[] = [];
  if (ownIds.length > 0) {
    const { data: links } = await admin
      .from("member_links")
      .select("child_member_id")
      .eq("tenant_id", tenantId)
      .in("parent_member_id", ownIds);
    const childIds = ((links ?? []) as Array<{ child_member_id: string }>).map(
      (l) => l.child_member_id,
    );
    if (childIds.length > 0) {
      const { data: kids } = await admin
        .from("members")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .in("id", childIds);
      childMembers = (kids ?? []) as Member[];
    }
  }

  const allMemberRows = [...own, ...childMembers.map((c) => ({ id: c.id, full_name: c.full_name }))];
  if (allMemberRows.length === 0) return [];
  const memberIds = allMemberRows.map((m) => m.id);

  const { data: gm } = await admin
    .from("group_members")
    .select("group_id, member_id")
    .in("member_id", memberIds);

  // Map per group → which OF THE USER's members are in it (for "Voor: ...").
  const groupToMembers = new Map<string, string[]>();
  // Track per-group whether the viewer is a trainer there.
  const trainerGroups = new Set<string>();
  for (const row of (gm ?? []) as Array<{ group_id: string; member_id: string }>) {
    const arr = groupToMembers.get(row.group_id) ?? [];
    arr.push(row.member_id);
    groupToMembers.set(row.group_id, arr);
    if (trainerMemberIds.has(row.member_id)) {
      trainerGroups.add(row.group_id);
    }
  }
  const groupIds = Array.from(groupToMembers.keys());
  if (groupIds.length === 0) return [];

  let q = admin
    .from("training_sessions")
    .select("*, group:groups(id,name)")
    .eq("tenant_id", tenantId)
    .in("group_id", groupIds)
    .order("starts_at", { ascending: true });
  if (opts.fromIso) q = q.gte("starts_at", opts.fromIso);
  if (opts.toIso) q = q.lte("starts_at", opts.toIso);
  q = q.limit(opts.limit ?? 200);

  const { data: sessions } = await q;
  const memberById = new Map(allMemberRows.map((m) => [m.id, m]));

  return ((sessions ?? []) as Array<
    TrainingSession & { group: Group | Group[] | null }
  >).map((s) => {
    const ids = groupToMembers.get(s.group_id) ?? [];
    const isTrainer = trainerGroups.has(s.group_id);
    const memberRows = ids
      .map((id) => memberById.get(id))
      .filter((m): m is { id: string; full_name: string } => !!m);
    // For trainer-only memberships (no athlete in the group), still expose
    // the trainer's own member id so the manage screen can authorize.
    return {
      ...s,
      group: Array.isArray(s.group) ? (s.group[0] ?? null) : s.group,
      forMembers: memberRows.map((m) => ({ id: m.id, full_name: m.full_name })),
      viewerRole: isTrainer ? "trainer" : "athlete",
    };
  });
}

/**
 * Returns attendance rows visible to the lid/ouder. The trainer's private
 * note is masked server-side: when `note_visibility !== 'member'` the
 * `note` and legacy `trainer_note` fields are stripped before reaching
 * the client.
 */
export async function getAttendanceForUser(
  tenantId: string,
  sessionId: string,
  memberIds: string[],
): Promise<TrainingAttendance[]> {
  if (memberIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("training_attendance")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId)
    .in("member_id", memberIds);
  return ((data ?? []) as TrainingAttendance[]).map((row) => {
    if (row.note_visibility === "member") return row;
    return { ...row, note: null, trainer_note: null };
  });
}

/**
 * Sprint 35 — read attendance for a session as a trainer. Uses the admin
 * client; caller MUST have already verified the user is a trainer of the
 * session's group (e.g. via {@link trainerInSessionGroup}).
 */
export async function getAttendanceForSession(
  tenantId: string,
  sessionId: string,
): Promise<
  Array<TrainingAttendance & { member: Pick<Member, "id" | "full_name"> | null }>
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("training_attendance")
    .select("*, member:members(id,full_name)")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  type Row = TrainingAttendance & { member: Member | Member[] | null };
  return ((data ?? []) as Row[]).map((row) => ({
    ...row,
    member: Array.isArray(row.member) ? (row.member[0] ?? null) : row.member,
  }));
}

/**
 * Sprint 35 — fetch a session by id with admin client (no RLS).
 */
export async function getTrainingSessionById(
  tenantId: string,
  sessionId: string,
): Promise<TrainingSessionWithGroup | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("training_sessions")
    .select("*, group:groups(id,name)")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  const row = data as TrainingSession & { group: Group | Group[] | null };
  return {
    ...row,
    group: Array.isArray(row.group) ? (row.group[0] ?? null) : row.group,
  };
}
