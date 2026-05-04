import { Mail } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { getProviderStatus, getEmailConfig } from "@/lib/config/email";
import { getAllTenants } from "@/lib/db/platform-tenants";
import { StatusPanel } from "./_status-panel";

export const dynamic = "force-dynamic";

export default async function PlatformEmailPage() {
  const status = getProviderStatus();
  const baseDomain = getEmailConfig().baseDomain;
  const tenants = await getAllTenants();

  return (
    <>
      <PageHeading
        title="Email — provider"
        description="Outbound mail is dispatched through the SendGrid API. The API key lives in environment secrets and never appears in the UI."
        actions={
          <Link
            href="/platform/email/logs"
            className="inline-flex h-9 items-center gap-2 rounded-xl border bg-transparent px-3 text-xs font-medium"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-secondary)",
            }}
          >
            <Mail className="h-3.5 w-3.5" /> View logs
          </Link>
        }
      />

      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <StatusPanel
          status={status}
          baseDomain={baseDomain}
          tenants={tenants.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            domain: t.domain,
            email_domain_verified: t.email_domain_verified,
          }))}
        />
      </div>
    </>
  );
}
