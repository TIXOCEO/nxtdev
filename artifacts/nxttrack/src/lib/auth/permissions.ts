import { redirect } from "next/navigation";
import { requireAuth } from "./require-auth";
import { getMemberships } from "./get-memberships";
import { hasTenantAccess } from "@/lib/permissions";
import { getUserPermissionsInTenant } from "@/lib/db/tenant-roles";

/**
 * True when the user is platform_admin, tenant_admin, OR has the given
 * permission via any of their custom tenant roles.
 */
export async function userHasPermission(
  tenantId: string,
  userId: string,
  permission: string,
): Promise<boolean> {
  const memberships = await getMemberships(userId);
  if (hasTenantAccess(memberships, tenantId)) return true;
  const perms = await getUserPermissionsInTenant(tenantId, userId);
  return perms.includes(permission);
}

/**
 * Server guard. Allows tenant_admin / platform_admin or a user with the given
 * permission. Otherwise redirects to /.
 */
export async function requirePermission(
  tenantId: string,
  permission: string,
): Promise<void> {
  const user = await requireAuth();
  const ok = await userHasPermission(tenantId, user.id, permission);
  if (!ok) redirect("/");
}
