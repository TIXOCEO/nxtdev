import { redirect } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAuth } from "@/lib/auth/require-auth";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { listSocialLinksAdmin } from "@/lib/db/social-links";
import { SocialLinksManager } from "./_manager";

export const dynamic = "force-dynamic";

export default async function TenantSocialPage() {
  await requireAuth();
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/");
  await requireTenantAdmin(tenantId);

  const rows = await listSocialLinksAdmin(tenantId);

  return (
    <>
      <PageHeading
        title="Social media"
        description="Vul de URLs in van je social media kanalen en zet de actieve kanalen aan. Actieve kanalen verschijnen onderaan de zijbalk van je publieke site."
      />
      <SocialLinksManager
        tenantId={tenantId}
        existing={rows.map((r) => ({
          platform: r.platform,
          url: r.url,
          is_active: r.is_active,
          sort_order: r.sort_order,
        }))}
      />
    </>
  );
}
