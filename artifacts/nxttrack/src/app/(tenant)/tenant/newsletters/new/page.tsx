import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getGroupsByTenant } from "@/lib/db/groups";
import { NewsletterEditor } from "../_newsletter-editor";

export const dynamic = "force-dynamic";

export default async function NewNewsletterPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const groups = await getGroupsByTenant(result.tenant.id);

  return (
    <>
      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        <Link
          href="/tenant/newsletters"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar overzicht
        </Link>
      </div>

      <PageHeading
        title="Nieuwe nieuwsbrief"
        description="Maak een concept aan, kies je doelgroep en verstuur direct."
      />

      <NewsletterEditor
        mode="create"
        tenant={result.tenant}
        groups={groups.map((g) => ({ id: g.id, name: g.name, member_count: g.member_count }))}
      />
    </>
  );
}
