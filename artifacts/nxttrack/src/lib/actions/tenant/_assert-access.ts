import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side guard for tenant-scoped server actions.
 * Throws if the caller is not authenticated, or has no admin access
 * to the given tenant. Platform admins always pass; tenant admins
 * (legacy enum) en admins-via-role passen ook.
 */
export async function assertTenantAccess(tenantId: string): Promise<User> {
  const user = await requireAuth();
  const [memberships, adminRoleTenants] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  if (!hasTenantAccess(memberships, tenantId, adminRoleTenants)) {
    throw new Error("Forbidden: no access to this tenant.");
  }
  return user;
}
