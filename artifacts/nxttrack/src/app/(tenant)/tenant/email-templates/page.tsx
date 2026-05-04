import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getEmailTemplatesByTenant } from "@/lib/db/email-templates";
import { SeedDefaultsButton } from "./_seed-button";
import { TemplateToggle } from "./_template-toggle";

export const dynamic = "force-dynamic";

export default async function TenantEmailTemplatesPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const templates = await getEmailTemplatesByTenant(result.tenant.id);

  return (
    <>
      <PageHeading
        title="E-mail templates"
        description="Pas onderwerpen en inhoud van uitgaande e-mails aan voor deze vereniging."
        actions={<SeedDefaultsButton tenantId={result.tenant.id} />}
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Nog geen templates"
          description="Klik op 'Standaard templates plaatsen' om de standaard set te installeren."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {t.name}
                  </p>
                  <p
                    className="mt-0.5 truncate text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span className="font-mono">{t.key}</span>
                  </p>
                  <p
                    className="mt-1.5 line-clamp-1 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t.subject}
                  </p>
                </div>
                <TemplateToggle
                  tenantId={result.tenant.id}
                  id={t.id}
                  isEnabled={t.is_enabled}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/tenant/email-templates/${t.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Bewerken <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
