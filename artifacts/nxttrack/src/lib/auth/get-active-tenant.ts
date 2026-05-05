import { requireAuth } from "./require-auth";
import { getMemberships } from "./get-memberships";
import { getAdminRoleTenantIds } from "./get-admin-role-tenants";
import { isPlatformAdmin, hasTenantAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Tenant, TenantMembership } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export type ActiveTenantResult =
  | {
      kind: "ok";
      user: User;
      tenant: Tenant;
      membership: TenantMembership | null;
      isPlatformAdmin: boolean;
      memberships: TenantMembership[];
    }
  | {
      kind: "needs_selection";
      user: User;
      memberships: TenantMembership[];
      tenants: Tenant[];
      isPlatformAdmin: boolean;
    }
  | {
      kind: "no_access";
      user: User;
    };

/**
 * Resolve the active tenant for the current user inside the /tenant area.
 *
 * - tenant_admin: returns the first assigned tenant by membership.
 * - platform_admin: respects an optional `tenantId` (typically from a query
 *   param). If none provided, returns `needs_selection` with all tenants.
 * - users with no tenant access: returns `no_access`.
 */
export async function getActiveTenant(
  requestedTenantId?: string | null,
): Promise<ActiveTenantResult> {
  const user = await requireAuth();
  const [memberships, adminRoleTenantIds] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  const supabase = await createClient();

  const platformAdmin = isPlatformAdmin(memberships);

  // Honor explicit tenant request if provided and user has access.
  if (requestedTenantId && hasTenantAccess(memberships, requestedTenantId, adminRoleTenantIds)) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", requestedTenantId)
      .maybeSingle();

    if (tenant) {
      return {
        kind: "ok",
        user,
        tenant: tenant as Tenant,
        membership:
          memberships.find((m) => m.tenant_id === requestedTenantId) ?? null,
        isPlatformAdmin: platformAdmin,
        memberships,
      };
    }
  }

  // Tenant admin (non-platform): use first assigned tenant.
  const tenantMemberships = memberships.filter(
    (m) => m.tenant_id !== null && m.role === "tenant_admin",
  );

  if (tenantMemberships.length > 0) {
    const first = tenantMemberships[0];
    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", first.tenant_id!)
      .maybeSingle();

    if (tenant) {
      return {
        kind: "ok",
        user,
        tenant: tenant as Tenant,
        membership: first,
        isPlatformAdmin: platformAdmin,
        memberships,
      };
    }
  }

  // Platform admin with no selection: list all tenants.
  if (platformAdmin) {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("*")
      .order("name", { ascending: true });

    return {
      kind: "needs_selection",
      user,
      memberships,
      tenants: (tenants ?? []) as Tenant[],
      isPlatformAdmin: true,
    };
  }

  return { kind: "no_access", user };
}
