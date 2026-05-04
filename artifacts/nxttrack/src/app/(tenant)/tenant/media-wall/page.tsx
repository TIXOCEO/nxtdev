import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listMediaWallItemsAdmin } from "@/lib/db/homepage";
import { MediaWallManager } from "@/components/tenant/media-wall/media-wall-manager";

export const dynamic = "force-dynamic";

export default async function TenantMediaWallPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const items = await listMediaWallItemsAdmin(result.tenant.id);
  return (
    <>
      <PageHeading
        title="Media Wall"
        description="Beheer afbeeldingen en video's voor de Media Wall module."
      />
      <MediaWallManager tenantId={result.tenant.id} initial={items} />
    </>
  );
}
