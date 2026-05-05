import type { TenantMembership, Role } from "@/types/database";

/**
 * Platform admin has role='platform_admin' AND tenant_id IS NULL.
 * Mirrors SQL function public.is_platform_admin().
 */
export function isPlatformAdmin(memberships: TenantMembership[]): boolean {
  return memberships.some(
    (m) => m.role === "platform_admin" && m.tenant_id === null,
  );
}

/**
 * Strict tenant admin check via the `tenant_memberships.role='tenant_admin'`
 * enum (legacy / platform-created admin). Mirrors `is_tenant_admin()` SQL fn.
 * Does NOT include platform admins or admins-via-role — use `hasTenantAccess()`.
 */
export function isTenantAdmin(
  memberships: TenantMembership[],
  tenantId: string,
): boolean {
  return memberships.some(
    (m) => m.tenant_id === tenantId && m.role === "tenant_admin",
  );
}

/**
 * Sprint 22 — True als de user toegang heeft tot het tenant-admin dashboard.
 * Drie wegen:
 *   1. platform_admin (tenant_memberships)
 *   2. tenant_admin enum-membership voor deze tenant
 *   3. lid van een tenant_role met scope='admin' voor deze tenant
 *
 * `adminRoleTenantIds` komt uit `getAdminRoleTenantIds(userId)` en bevat alle
 * tenants waarvoor de user via tenant_member_roles ↔ tenant_roles(scope='admin')
 * admin-toegang heeft. Mirrors SQL functie `has_tenant_access(tenant_id)`.
 */
export function hasTenantAccess(
  memberships: TenantMembership[],
  tenantId: string,
  adminRoleTenantIds: string[] = [],
): boolean {
  return (
    isPlatformAdmin(memberships) ||
    isTenantAdmin(memberships, tenantId) ||
    adminRoleTenantIds.includes(tenantId)
  );
}

/** Returns true if the user has any (non-platform) membership in the given tenant. */
export function hasMembership(
  memberships: TenantMembership[],
  tenantId: string,
): boolean {
  return memberships.some((m) => m.tenant_id === tenantId);
}

/** The user's role for a specific tenant, or null if they have none. */
export function getMembershipRole(
  memberships: TenantMembership[],
  tenantId: string,
): Role | null {
  return memberships.find((m) => m.tenant_id === tenantId)?.role ?? null;
}
