import { getAdminRoleTenantIds as fetch } from "@/lib/db/tenant-roles";

/**
 * Sprint 22 — Wrapper die de tenant_ids ophaalt waarvoor de user een
 * tenant_role met scope='admin' heeft. Zie `hasTenantAccess()`.
 */
export async function getAdminRoleTenantIds(userId: string): Promise<string[]> {
  return fetch(userId);
}
