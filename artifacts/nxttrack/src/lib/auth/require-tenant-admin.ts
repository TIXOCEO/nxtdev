import { redirect } from "next/navigation";
import { requireAuth } from "./require-auth";
import { getMemberships } from "./get-memberships";
import { hasTenantAccess } from "@/lib/permissions";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side tenant admin guard.
 * Allows tenant admins of `tenantId` AND platform admins.
 * Redirects to / if authenticated but unauthorized,
 * to /login if not authenticated.
 *
 * @param tenantId  The UUID of the tenant being accessed (not the slug).
 */
export async function requireTenantAdmin(tenantId: string): Promise<User> {
  const user = await requireAuth();
  const memberships = await getMemberships(user.id);

  if (!hasTenantAccess(memberships, tenantId)) {
    redirect("/");
  }

  return user;
}
