import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { listTenantRolesWithPerms } from "@/lib/db/tenant-roles";
import {
  seedDefaultRolesIfEmpty,
  ensureSuperAdminHasAllPermissions,
} from "@/lib/actions/tenant/roles";
import { isSuperAdminRole } from "@/lib/roles/is-super-admin";
import { RolesManager } from "./_manager";

export const dynamic = "force-dynamic";

export default async function TenantRolesPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const tenantId = result.tenant.id;
  await requireTenantAdmin(tenantId);

  // First-visit: ensure system roles exist (Beheerder, Lid).
  // Defensief: een fout in de seed (bv. ontbrekende permissie-key in catalog,
  // RLS policy issue) mag de hele rollenpagina niet blokkeren.
  try {
    await seedDefaultRolesIfEmpty({ tenant_id: tenantId });
  } catch (err) {
    console.error("seedDefaultRolesIfEmpty failed:", err);
  }
  // Re-sync: nieuwe permissies in de catalog automatisch aan super admin geven.
  try {
    await ensureSuperAdminHasAllPermissions({ tenant_id: tenantId });
  } catch (err) {
    console.error("ensureSuperAdminHasAllPermissions failed:", err);
  }

  const roles = await listTenantRolesWithPerms(tenantId).catch((err) => {
    console.error("listTenantRolesWithPerms failed:", err);
    return [] as Awaited<ReturnType<typeof listTenantRolesWithPerms>>;
  });

  return (
    <>
      <PageHeading
        title="Rollen & permissies"
        description="Maak eigen rollen aan en bepaal precies welke acties leden met die rol mogen uitvoeren."
      />
      <RolesManager
        tenantId={tenantId}
        roles={roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          is_system: r.is_system,
          sort_order: r.sort_order,
          permissions: r.permissions,
          member_count: r.member_count,
          scope: r.scope,
          is_super_admin: isSuperAdminRole({ is_super_admin: r.is_super_admin }),
        }))}
      />
    </>
  );
}
