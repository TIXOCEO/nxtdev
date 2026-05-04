import { redirect } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAuth } from "@/lib/auth/require-auth";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import {
  getTenantSeoSettings,
  listPageSeoForTenant,
} from "@/lib/db/tenant-seo";
import { TenantSeoForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function TenantSeoPage() {
  await requireAuth();
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/");
  await requireTenantAdmin(tenantId);

  const [settings, pageOverrides] = await Promise.all([
    getTenantSeoSettings(tenantId),
    listPageSeoForTenant(tenantId),
  ]);

  return (
    <>
      <PageHeading
        title="SEO"
        description="Bepaal hoe jouw club verschijnt in zoekmachines en sociale media. De standaard wordt overal gebruikt; per pagina kun je afwijken."
      />
      <TenantSeoForm
        tenantId={tenantId}
        defaults={{
          default_title: settings?.default_title ?? "",
          title_template: settings?.title_template ?? "%s | %tenant%",
          default_description: settings?.default_description ?? "",
          default_image_url: settings?.default_image_url ?? "",
          og_site_name: settings?.og_site_name ?? "",
          twitter_handle: settings?.twitter_handle ?? "",
        }}
        overrides={pageOverrides.map((p) => ({
          id: p.id,
          page_path: p.page_path,
          title: p.title ?? "",
          description: p.description ?? "",
          image_url: p.image_url ?? "",
          noindex: p.noindex,
        }))}
      />
    </>
  );
}
