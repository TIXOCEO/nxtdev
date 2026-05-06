import { createAdminClient } from "@/lib/supabase/admin";
import type { Member, MemberRoleName } from "@/types/database";

export interface UserTenantContext {
  /** All member rows owned by this user in the tenant (rare — usually one). */
  members: Member[];
  /** Aggregated role names from member_roles for the user's own member rows. */
  roles: MemberRoleName[];
  /** Children members linked via member_links where the user owns a parent member. */
  children: Member[];
  /** Sprint 30 — true wanneer een tenant-custom rol met `is_trainer_role` aanstaat. */
  hasCustomTrainerRole: boolean;
}

const EMPTY: UserTenantContext = {
  members: [],
  roles: [],
  children: [],
  hasCustomTrainerRole: false,
};

/**
 * Resolve everything we need about a user's relationship to a tenant in a
 * single round-trip set: their member rows, their roles, and any linked
 * children. Uses the admin client because this spans multiple tables and
 * the caller already has a validated user.
 */
export async function getUserTenantContext(
  tenantId: string,
  userId: string,
): Promise<UserTenantContext> {
  const admin = createAdminClient();

  const { data: members } = await admin
    .from("members")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  const ownMembers = (members ?? []) as Member[];
  if (ownMembers.length === 0) return EMPTY;

  const memberIds = ownMembers.map((m) => m.id);

  const [{ data: roleRows }, { data: linkRows }, { data: tmRoleRows }] =
    await Promise.all([
      admin.from("member_roles").select("member_id, role").in("member_id", memberIds),
      admin
        .from("member_links")
        .select("child_member_id")
        .eq("tenant_id", tenantId)
        .in("parent_member_id", memberIds),
      admin
        .from("tenant_member_roles")
        .select("member_id, tenant_roles!inner(is_trainer_role)")
        .eq("tenant_id", tenantId)
        .in("member_id", memberIds),
    ]);

  const roles = Array.from(
    new Set(
      ((roleRows ?? []) as Array<{ role: string }>).map((r) => r.role),
    ),
  ) as MemberRoleName[];

  type TmRow = {
    tenant_roles:
      | { is_trainer_role: boolean }
      | { is_trainer_role: boolean }[]
      | null;
  };
  const hasCustomTrainerRole = ((tmRoleRows ?? []) as TmRow[]).some((r) => {
    const list = Array.isArray(r.tenant_roles)
      ? r.tenant_roles
      : r.tenant_roles
        ? [r.tenant_roles]
        : [];
    return list.some((tr) => tr.is_trainer_role);
  });

  const childIds = ((linkRows ?? []) as Array<{ child_member_id: string }>).map(
    (l) => l.child_member_id,
  );

  let children: Member[] = [];
  if (childIds.length > 0) {
    const { data } = await admin
      .from("members")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("id", childIds);
    children = (data ?? []) as Member[];
  }

  return { members: ownMembers, roles, children, hasCustomTrainerRole };
}

// ── Pure helpers ──────────────────────────────────────────

export function hasRole(ctx: UserTenantContext, role: MemberRoleName): boolean {
  return ctx.roles.includes(role);
}

export function isParent(ctx: UserTenantContext): boolean {
  return hasRole(ctx, "parent") || ctx.children.length > 0;
}

export function isTrainer(ctx: UserTenantContext): boolean {
  return hasRole(ctx, "trainer") || ctx.hasCustomTrainerRole;
}

export function isAthlete(ctx: UserTenantContext): boolean {
  return hasRole(ctx, "athlete");
}

/**
 * Practical "minor athlete" proxy: an athlete-member that is also linked
 * as a child in member_links. Members table has no DOB column so we use
 * the parent-link relationship as the authoritative signal.
 *
 * Caller passes the member id to test plus the full link map (or we
 * accept a precomputed boolean).
 */
export function isMinorAthlete(
  member: Pick<Member, "id">,
  isLinkedAsChild: boolean,
  roles: MemberRoleName[] | string[],
): boolean {
  void member;
  return roles.includes("athlete") && isLinkedAsChild;
}

/**
 * True when the user owns the member directly OR is a parent of that member
 * via member_links. Caller has already loaded the user context.
 */
export function userCanActForMember(
  ctx: UserTenantContext,
  memberId: string,
): boolean {
  if (ctx.members.some((m) => m.id === memberId)) return true;
  if (ctx.children.some((c) => c.id === memberId)) return true;
  return false;
}

/**
 * Server-checked equivalent of {@link userCanActForMember}.
 * Re-validates against the DB so callers can rely on it for authorization.
 */
export async function parentCanActForChild(
  tenantId: string,
  userId: string,
  childMemberId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: ownMembers } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  const ownIds = ((ownMembers ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (ownIds.includes(childMemberId)) return true;
  if (ownIds.length === 0) return false;
  const { data: link } = await admin
    .from("member_links")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("child_member_id", childMemberId)
    .in("parent_member_id", ownIds)
    .maybeSingle();
  return !!link;
}

/**
 * True when the trainer is in any group that the athlete is also in.
 */
export async function trainerCanManageAthlete(
  tenantId: string,
  trainerMemberId: string,
  athleteMemberId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: trainerGroups } = await admin
    .from("group_members")
    .select("group_id, members!inner(tenant_id)")
    .eq("members.tenant_id", tenantId)
    .eq("member_id", trainerMemberId);
  const groupIds = ((trainerGroups ?? []) as Array<{ group_id: string }>).map(
    (g) => g.group_id,
  );
  if (groupIds.length === 0) return false;
  const { data: shared } = await admin
    .from("group_members")
    .select("id")
    .eq("member_id", athleteMemberId)
    .in("group_id", groupIds)
    .maybeSingle();
  return !!shared;
}
