import { redirect } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAuth } from "@/lib/auth/require-auth";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { listTenantRolesWithPerms } from "@/lib/db/tenant-roles";
import { seedDefaultRolesIfEmpty } from "@/lib/actions/tenant/roles";
import { RolesManager } from "./_manager";

export const dynamic = "force-dynamic";

export default async function TenantRolesPage() {
  await requireAuth();
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/");
  await requireTenantAdmin(tenantId);

  // First-visit: ensure system roles exist (Beheerder, Lid).
  await seedDefaultRolesIfEmpty({ tenant_id: tenantId });

  const roles = await listTenantRolesWithPerms(tenantId);

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
        }))}
      />
    </>
  );
}
