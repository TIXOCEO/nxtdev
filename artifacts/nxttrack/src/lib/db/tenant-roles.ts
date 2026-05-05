import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TenantRoleScope } from "@/types/database";

export interface TenantRoleRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  sort_order: number;
  scope: TenantRoleScope;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantRoleWithPerms extends TenantRoleRow {
  permissions: string[];
  member_count: number;
}

export interface TenantMemberRoleAssignment {
  tenant_id: string;
  member_id: string;
  role_id: string;
  created_at: string;
}

export async function listTenantRoles(tenantId: string): Promise<TenantRoleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_roles")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("scope", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as TenantRoleRow[];
}

export async function listTenantRolesWithPerms(
  tenantId: string,
): Promise<TenantRoleWithPerms[]> {
  const admin = createAdminClient();
  const [{ data: roles }, { data: perms }, { data: assigns }] = await Promise.all([
    admin
      .from("tenant_roles")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("scope", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("tenant_role_permissions")
      .select("role_id, permission, tenant_roles!inner(tenant_id)")
      .eq("tenant_roles.tenant_id", tenantId),
    admin
      .from("tenant_member_roles")
      .select("role_id")
      .eq("tenant_id", tenantId),
  ]);

  const permsByRole = new Map<string, string[]>();
  for (const r of (perms ?? []) as Array<{ role_id: string; permission: string }>) {
    const arr = permsByRole.get(r.role_id) ?? [];
    arr.push(r.permission);
    permsByRole.set(r.role_id, arr);
  }
  const countByRole = new Map<string, number>();
  for (const a of (assigns ?? []) as Array<{ role_id: string }>) {
    countByRole.set(a.role_id, (countByRole.get(a.role_id) ?? 0) + 1);
  }

  return ((roles ?? []) as TenantRoleRow[]).map((r) => ({
    ...r,
    permissions: permsByRole.get(r.id) ?? [],
    member_count: countByRole.get(r.id) ?? 0,
  }));
}

export async function listMemberRoleAssignments(
  tenantId: string,
): Promise<TenantMemberRoleAssignment[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_member_roles")
    .select("*")
    .eq("tenant_id", tenantId);
  return (data ?? []) as TenantMemberRoleAssignment[];
}

/** Permissions granted (transitively) to a user via their member roles. */
export async function getUserPermissionsInTenant(
  tenantId: string,
  userId: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  const memberIds = ((members ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (memberIds.length === 0) return [];
  const { data: assigns } = await admin
    .from("tenant_member_roles")
    .select("role_id")
    .eq("tenant_id", tenantId)
    .in("member_id", memberIds);
  const roleIds = Array.from(
    new Set(((assigns ?? []) as Array<{ role_id: string }>).map((a) => a.role_id)),
  );
  if (roleIds.length === 0) return [];
  const { data: perms } = await admin
    .from("tenant_role_permissions")
    .select("permission")
    .in("role_id", roleIds);
  return Array.from(
    new Set(((perms ?? []) as Array<{ permission: string }>).map((p) => p.permission)),
  );
}

/**
 * Sprint 22 — Lijst van tenant_ids waar deze user een tenant_role met
 * scope='admin' heeft via tenant_member_roles. Een user is admin van een
 * tenant als hij òf platform_admin is, òf een tenant_admin enum-rol heeft,
 * òf in deze lijst voorkomt.
 */
export async function getAdminRoleTenantIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("members")
    .select("id, tenant_id")
    .eq("user_id", userId);
  const memberRows = (members ?? []) as Array<{ id: string; tenant_id: string }>;
  if (memberRows.length === 0) return [];

  const memberIds = memberRows.map((m) => m.id);
  const { data: assigns } = await admin
    .from("tenant_member_roles")
    .select("role_id, tenant_id, member_id")
    .in("member_id", memberIds);
  const assignRows = (assigns ?? []) as Array<{
    role_id: string;
    tenant_id: string;
    member_id: string;
  }>;
  if (assignRows.length === 0) return [];

  const roleIds = Array.from(new Set(assignRows.map((a) => a.role_id)));
  const { data: roles } = await admin
    .from("tenant_roles")
    .select("id, scope, tenant_id")
    .in("id", roleIds);
  const adminRoleIds = new Set(
    ((roles ?? []) as Array<{ id: string; scope: string; tenant_id: string }>)
      .filter((r) => r.scope === "admin")
      .map((r) => r.id),
  );
  if (adminRoleIds.size === 0) return [];

  const tenantSet = new Set<string>();
  for (const a of assignRows) {
    if (adminRoleIds.has(a.role_id)) tenantSet.add(a.tenant_id);
  }
  return Array.from(tenantSet);
}
