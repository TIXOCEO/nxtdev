import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listSponsorsAdmin } from "@/lib/db/homepage";
import { SponsorsManager } from "@/components/tenant/sponsors/sponsors-manager";

export const dynamic = "force-dynamic";

export default async function TenantSponsorsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const items = await listSponsorsAdmin(result.tenant.id);
  return (
    <>
      <PageHeading title="Sponsoren" description="Beheer sponsoren voor de homepage." />
      <SponsorsManager tenantId={result.tenant.id} initial={items} />
    </>
  );
}
