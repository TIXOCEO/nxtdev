import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantHomepageModules, getModuleCatalog } from "@/lib/db/homepage";
import { listEnabledCustomPages, buildPageTree } from "@/lib/db/custom-pages";
import { getPublicNewsCategories } from "@/lib/db/public-tenant";
import { HomepageBuilder } from "@/components/tenant/homepage/homepage-builder";
import type { PageOption } from "@/components/tenant/homepage/module-config-editor";

export const dynamic = "force-dynamic";

function flattenPaths(
  nodes: ReturnType<typeof buildPageTree>,
): PageOption[] {
  const out: PageOption[] = [];
  function walk(list: ReturnType<typeof buildPageTree>) {
    for (const n of list) {
      out.push({ path: n.path, title: n.title });
      if (n.children.length > 0) walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

export default async function TenantHomepageBuilderPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [modules, catalog, customPages, newsCategories] = await Promise.all([
    getTenantHomepageModules(result.tenant.id),
    getModuleCatalog(),
    listEnabledCustomPages(result.tenant.id),
    getPublicNewsCategories(result.tenant.id),
  ]);
  const pages = flattenPaths(buildPageTree(customPages));

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
        pages={pages}
        newsCategories={newsCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  );
}
