import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAuth } from "@/lib/auth/require-auth";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { listCustomPagesForAdmin } from "@/lib/db/custom-pages";
import { CustomPagesManager } from "../_manager";

export const dynamic = "force-dynamic";

export default async function TenantMenuOrderPage() {
  await requireAuth();
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/");
  await requireTenantAdmin(tenantId);

  const pages = await listCustomPagesForAdmin(tenantId);

  return (
    <>
      <PageHeading
        title="Menu volgorde"
        description="Sleep menu-items om de volgorde aan te passen. Wijzigingen verschijnen direct in het publieke menu."
      />
      <p className="mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        Inhoud bewerken? Ga naar{" "}
        <Link href="/tenant/pages" className="font-semibold underline">
          Pagina&apos;s <ArrowRight className="inline h-3 w-3" />
        </Link>
      </p>
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
