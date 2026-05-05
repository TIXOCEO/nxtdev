import { redirect } from "next/navigation";
import { requireAuth } from "./require-auth";
import { getMemberships } from "./get-memberships";
import { getAdminRoleTenantIds } from "./get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side tenant admin guard.
 * Allows platform admins, tenant_admin (legacy enum) en admins-via-role.
 * Redirects to / if authenticated but unauthorized,
 * to /login if not authenticated.
 *
 * @param tenantId  The UUID of the tenant being accessed (not the slug).
 */
export async function requireTenantAdmin(tenantId: string): Promise<User> {
  const user = await requireAuth();
  const [memberships, adminRoleTenants] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);

  if (!hasTenantAccess(memberships, tenantId, adminRoleTenants)) {
    redirect("/");
  }

  return user;
}
