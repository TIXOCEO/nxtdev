import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getNewsletterById } from "@/lib/db/newsletters";
import { getGroupsByTenant } from "@/lib/db/groups";
import { NewsletterEditor } from "../_newsletter-editor";
import { BrandedEmailPreview } from "@/components/tenant/email/branded-email-preview";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewsletterDetailPage({ params }: PageProps) {
  const { id } = await params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const newsletter = await getNewsletterById(id, result.tenant.id);
  if (!newsletter) notFound();
  const groups = await getGroupsByTenant(result.tenant.id);

  const isReadOnly = newsletter.status === "sent" || newsletter.status === "sending";

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
        title={newsletter.title || "Nieuwsbrief"}
        description={
          isReadOnly
            ? newsletter.status === "sent"
              ? `Verstuurd op ${newsletter.sent_at ? new Date(newsletter.sent_at).toLocaleString("nl-NL") : "—"} naar ${newsletter.sent_count}/${newsletter.recipient_count} ontvangers`
              : "Wordt op dit moment verstuurd…"
            : "Bewerk het concept, controleer in voorbeeld en verstuur."
        }
      />

      {isReadOnly ? (
        <div className="space-y-3">
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Onderwerp
          </p>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {newsletter.title}
          </p>
          <BrandedEmailPreview
            tenant={result.tenant}
            innerHtml={newsletter.content_html}
            preheader={newsletter.preheader}
          />
        </div>
      ) : (
        <NewsletterEditor
          mode="edit"
          tenant={result.tenant}
          newsletter={newsletter}
          groups={groups.map((g) => ({ id: g.id, name: g.name, member_count: g.member_count }))}
        />
      )}
    </>
  );
}
