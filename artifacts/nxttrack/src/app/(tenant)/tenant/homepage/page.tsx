import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantHomepageModules, getModuleCatalog } from "@/lib/db/homepage";
import { HomepageBuilder } from "@/components/tenant/homepage/homepage-builder";

export const dynamic = "force-dynamic";

export default async function TenantHomepageBuilderPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [modules, catalog] = await Promise.all([
    getTenantHomepageModules(result.tenant.id),
    getModuleCatalog(),
  ]);

  return (
    <>
      <PageHeading
        title="Homepage modules"
        description="Bouw je publieke homepage met sleepbare modules, max 2 kolommen."
      />
      <HomepageBuilder
        tenantId={result.tenant.id}
        initialModules={modules}
        catalog={catalog}
      />
    </>
  );
}
