import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Member,
  MemberRole,
  MemberLink,
  GroupMember,
  Group,
  MemberMembership,
  MembershipPaymentLog,
  MembershipPlan,
} from "@/types/database";

export interface MemberListRow extends Member {
  roles: string[];
  group_names: string[];
  /** Sprint G — email of the admin who archived this member (only set on archived view). */
  archived_by_email: string | null;
}

/**
 * List members for a tenant, with derived role names and group names.
 * Aggregations are done in JS to keep the SQL portable across PostgREST.
 */
export type MemberSortKey =
  | "name"
  | "status"
  | "member_since"
  | "archived_at"
  | "created_at";
export type SortOrder = "asc" | "desc";

export interface GetMembersOptions {
  /** Sprint F — when false (default) archived members are filtered out. */
  includeArchived?: boolean;
  /** Sprint F — when true, only archived members are returned. */
  onlyArchived?: boolean;
  /** Sprint G — inclusive lower bound on `member_since` (ISO date yyyy-mm-dd). */
  memberSinceFrom?: string | null;
  /** Sprint G — inclusive upper bound on `member_since` (ISO date yyyy-mm-dd). */
  memberSinceTo?: string | null;
  /** Sprint G — column to sort by. */
  sortBy?: MemberSortKey;
  /** Sprint G — sort direction. */
  sortOrder?: SortOrder;
}

export async function getMembersByTenant(
  tenantId: string,
  opts: GetMembersOptions = {},
): Promise<MemberListRow[]> {
  const supabase = await createClient();

  const sortBy: MemberSortKey = opts.sortBy ?? "created_at";
  const ascending = (opts.sortOrder ?? "desc") === "asc";
  const sortColumn =
    sortBy === "name"
      ? "full_name"
      : sortBy === "status"
        ? "member_status"
        : sortBy === "member_since"
          ? "member_since"
          : sortBy === "archived_at"
            ? "archived_at"
            : "created_at";

  const baseQuery = () => {
    let q = supabase
      .from("members")
      .select("*")
      .eq("tenant_id", tenantId)
      .order(sortColumn, { ascending, nullsFirst: false });
    if (opts.onlyArchived) {
      q = q.not("archived_at", "is", null);
    } else if (!opts.includeArchived) {
      q = q.is("archived_at", null);
    }
    if (opts.memberSinceFrom) {
      q = q.gte("member_since", opts.memberSinceFrom);
    }
    if (opts.memberSinceTo) {
      q = q.lte("member_since", opts.memberSinceTo);
    }
    return q;
  };

  const [{ data: members, error: mErr }, { data: roles }, { data: groupMems }, { data: groups }] =
    await Promise.all([
      baseQuery(),
      supabase
        .from("member_roles")
        .select("member_id, role, members!inner(tenant_id)")
        .eq("members.tenant_id", tenantId),
      supabase
        .from("group_members")
        .select("member_id, group_id, groups!inner(tenant_id, name)")
        .eq("groups.tenant_id", tenantId),
      supabase.from("groups").select("id, name").eq("tenant_id", tenantId),
    ]);

  if (mErr) throw new Error(`Failed to fetch members: ${mErr.message}`);

  const rolesByMember = new Map<string, string[]>();
  for (const r of (roles ?? []) as Array<{ member_id: string; role: string }>) {
    const arr = rolesByMember.get(r.member_id) ?? [];
    arr.push(r.role);
    rolesByMember.set(r.member_id, arr);
  }

  const groupNameById = new Map<string, string>();
  for (const g of (groups ?? []) as Array<{ id: string; name: string }>) {
    groupNameById.set(g.id, g.name);
  }

  const groupsByMember = new Map<string, string[]>();
  for (const gm of (groupMems ?? []) as Array<{ member_id: string; group_id: string }>) {
    const name = groupNameById.get(gm.group_id);
    if (!name) continue;
    const arr = groupsByMember.get(gm.member_id) ?? [];
    arr.push(name);
    groupsByMember.set(gm.member_id, arr);
  }

  const memberRows = (members ?? []) as Member[];

  // Sprint G — for the archived view, hydrate the email of the admin who
  // archived each row. We only do this when explicitly requested, since it
  // requires the admin client and N auth lookups.
  const archivedByEmail = new Map<string, string>();
  if (opts.onlyArchived) {
    const actorIds = Array.from(
      new Set(
        memberRows
          .map((m) => m.archived_by)
          .filter((v): v is string => !!v),
      ),
    );
    if (actorIds.length > 0) {
      const admin = createAdminClient();
      await Promise.all(
        actorIds.map(async (id) => {
          try {
            const { data: u } = await admin.auth.admin.getUserById(id);
            if (u?.user?.email) archivedByEmail.set(id, u.user.email);
          } catch {
            // Leave blank — UI falls back to "—".
          }
        }),
      );
    }
  }

  return memberRows.map((m) => ({
    ...m,
    roles: rolesByMember.get(m.id) ?? [],
    group_names: groupsByMember.get(m.id) ?? [],
    archived_by_email: m.archived_by
      ? archivedByEmail.get(m.archived_by) ?? null
      : null,
  }));
}

export async function getMemberById(id: string, tenantId: string): Promise<Member | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch member: ${error.message}`);
  return (data as Member | null) ?? null;
}

export interface MemberWithRelations {
  member: Member;
  roles: MemberRole[];
  groups: Group[];
  group_links: GroupMember[];
  parents: Member[];
  children: Member[];
  parent_links: MemberLink[];
  child_links: MemberLink[];
  memberships: Array<MemberMembership & { plan: MembershipPlan | null }>;
  payments: MembershipPaymentLog[];
}

export async function getMemberWithRelations(
  id: string,
  tenantId: string,
): Promise<MemberWithRelations | null> {
  const supabase = await createClient();

  const member = await getMemberById(id, tenantId);
  if (!member) return null;

  const [
    { data: roles },
    { data: groupLinks },
    { data: parentLinks },
    { data: childLinks },
    { data: memberships },
  ] = await Promise.all([
    supabase.from("member_roles").select("*").eq("member_id", id),
    supabase
      .from("group_members")
      .select("*, groups!inner(id, tenant_id, name, description, created_at)")
      .eq("member_id", id)
      .eq("groups.tenant_id", tenantId),
    // Links where this member is the child (we want their parents)
    supabase
      .from("member_links")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("child_member_id", id),
    // Links where this member is the parent (we want their children)
    supabase
      .from("member_links")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("parent_member_id", id),
    supabase
      .from("member_memberships")
      .select("*, membership_plans(*)")
      .eq("member_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const groupRows = (groupLinks ?? []) as Array<GroupMember & { groups: Group }>;
  const groups = groupRows.map((row) => row.groups);
  const group_links: GroupMember[] = groupRows.map(
    ({ groups: _g, ...rest }) => rest as GroupMember,
  );

  const parents: Member[] = [];
  const children: Member[] = [];
  const parent_links = (parentLinks ?? []) as MemberLink[];
  const child_links = (childLinks ?? []) as MemberLink[];

  const parentIds = parent_links.map((l) => l.parent_member_id);
  const childIds = child_links.map((l) => l.child_member_id);

  if (parentIds.length > 0) {
    const { data } = await supabase
      .from("members")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("id", parentIds);
    parents.push(...((data ?? []) as Member[]));
  }
  if (childIds.length > 0) {
    const { data } = await supabase
      .from("members")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("id", childIds);
    children.push(...((data ?? []) as Member[]));
  }

  const memberships2 = ((memberships ?? []) as Array<
    MemberMembership & { membership_plans: MembershipPlan | null }
  >).map(({ membership_plans, ...rest }) => ({
    ...(rest as MemberMembership),
    plan: membership_plans ?? null,
  }));

  let payments: MembershipPaymentLog[] = [];
  const membershipIds = memberships2.map((m) => m.id);
  if (membershipIds.length > 0) {
    const { data } = await supabase
      .from("membership_payment_logs")
      .select("*")
      .in("member_membership_id", membershipIds)
      .order("created_at", { ascending: false });
    payments = (data ?? []) as MembershipPaymentLog[];
  }

  return {
    member,
    roles: (roles ?? []) as MemberRole[],
    groups,
    group_links,
    parents,
    children,
    parent_links,
    child_links,
    memberships: memberships2,
    payments,
  };
}
