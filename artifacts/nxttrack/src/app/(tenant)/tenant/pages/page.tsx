import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { listCustomPagesForAdmin } from "@/lib/db/custom-pages";
import { CustomPagesManager } from "./_manager";

export const dynamic = "force-dynamic";

export default async function TenantCustomPagesPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const tenantId = result.tenant.id;
  await requireTenantAdmin(tenantId);

  const pages = await listCustomPagesForAdmin(tenantId);

  return (
    <>
      <PageHeading
        title="Eigen pagina's"
        description="Maak menu-knoppen en bijbehorende pagina's. Submenu's mogen onder een hoofdmenu hangen."
      />
      <CustomPagesManager
        tenantId={tenantId}
        pages={pages.map((p) => ({
          id: p.id,
          parent_id: p.parent_id,
          title: p.title,
          slug: p.slug,
          content_html: p.content_html,
          requires_auth: p.requires_auth,
          is_enabled: p.is_enabled,
          show_in_menu: p.show_in_menu,
          sort_order: p.sort_order,
        }))}
      />
    </>
  );
}
