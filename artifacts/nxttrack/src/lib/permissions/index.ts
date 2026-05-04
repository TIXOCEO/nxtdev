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
 * Strict tenant admin check (role='tenant_admin' for the given tenant).
 * Mirrors SQL function public.is_tenant_admin(target_tenant_id).
 * Does NOT include platform admins — use hasTenantAccess() for that.
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
 * True if the user is a platform admin OR a tenant admin for `tenantId`.
 * Mirrors SQL function public.has_tenant_access(target_tenant_id).
 */
export function hasTenantAccess(
  memberships: TenantMembership[],
  tenantId: string,
): boolean {
  return isPlatformAdmin(memberships) || isTenantAdmin(memberships, tenantId);
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
