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

/**
 * For the public schedule: sessions visible to a given user — own
 * group memberships PLUS those of any linked children. Uses the admin
 * client because this spans members/group_members/member_links and the
 * caller already authenticated.
 */
export async function getSessionsForUser(
  tenantId: string,
  userId: string,
  opts: { fromIso?: string } = {},
): Promise<
  Array<
    TrainingSessionWithGroup & {
      forMembers: Array<Pick<Member, "id" | "full_name">>;
    }
  >
> {
  const admin = createAdminClient();

  // Find every member in this tenant relevant to the user (own + children).
  const { data: ownMembers } = await admin
    .from("members")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  const ownIds = ((ownMembers ?? []) as Member[]).map((m) => m.id);
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

  const allMembers = [...((ownMembers ?? []) as Member[]), ...childMembers];
  if (allMembers.length === 0) return [];
  const memberIds = allMembers.map((m) => m.id);

  const { data: gm } = await admin
    .from("group_members")
    .select("group_id, member_id")
    .in("member_id", memberIds);
  const groupToMembers = new Map<string, string[]>();
  for (const row of (gm ?? []) as Array<{ group_id: string; member_id: string }>) {
    const arr = groupToMembers.get(row.group_id) ?? [];
    arr.push(row.member_id);
    groupToMembers.set(row.group_id, arr);
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

  const { data: sessions } = await q;
  const memberById = new Map(allMembers.map((m) => [m.id, m]));

  return ((sessions ?? []) as Array<
    TrainingSession & { group: Group | Group[] | null }
  >).map((s) => {
    const ids = groupToMembers.get(s.group_id) ?? [];
    return {
      ...s,
      group: Array.isArray(s.group) ? (s.group[0] ?? null) : s.group,
      forMembers: ids
        .map((id) => memberById.get(id))
        .filter((m): m is Member => !!m)
        .map((m) => ({ id: m.id, full_name: m.full_name })),
    };
  });
}

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
  return (data ?? []) as TrainingAttendance[];
}
