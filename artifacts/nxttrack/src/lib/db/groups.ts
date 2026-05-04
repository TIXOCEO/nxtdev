import { createClient } from "@/lib/supabase/server";
import type { Group, Member, MemberRole } from "@/types/database";

export interface GroupWithCount extends Group {
  member_count: number;
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
      .select("group_id, groups!inner(tenant_id)")
      .eq("groups.tenant_id", tenantId),
  ]);

  if (gErr) throw new Error(`Failed to fetch groups: ${gErr.message}`);

  const counts = new Map<string, number>();
  for (const l of (links ?? []) as Array<{ group_id: string }>) {
    counts.set(l.group_id, (counts.get(l.group_id) ?? 0) + 1);
  }

  return ((groups ?? []) as Group[]).map((g) => ({
    ...g,
    member_count: counts.get(g.id) ?? 0,
  }));
}

export interface GroupDetail {
  group: Group;
  athletes: Array<Pick<Member, "id" | "full_name" | "member_status">>;
  trainers: Array<Pick<Member, "id" | "full_name" | "member_status">>;
  staff: Array<Pick<Member, "id" | "full_name" | "member_status">>;
  /** All other members in this group not in athletes/trainers/staff buckets. */
  others: Array<Pick<Member, "id" | "full_name" | "member_status">>;
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
    .select("member_id")
    .eq("group_id", groupId);
  const memberIds = ((gm ?? []) as Array<{ member_id: string }>).map((r) => r.member_id);

  if (memberIds.length === 0) {
    return { group: g as Group, athletes: [], trainers: [], staff: [], others: [] };
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
    if (set.has("trainer")) trainers.push(m);
    else if (set.has("athlete")) athletes.push(m);
    else if (set.has("staff")) staff.push(m);
    else others.push(m);
  }

  return { group: g as Group, athletes, trainers, staff, others };
}
