import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { getTenantWithMemberships } from "@/lib/db/platform-tenants";
import { TenantForm } from "../_tenant-form";
import { MasterAdminCard } from "./_master-admin-card";
import { CustomDomainCard } from "./_custom-domain-card";
import { SectorCard } from "./_sector-card";
import { listSectorTemplates } from "@/lib/db/sector-templates";
import { DEFAULT_TERMINOLOGY } from "@/lib/terminology/defaults";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EditTenantPage({ params }: Params) {
  const { id } = await params;
  const data = await getTenantWithMemberships(id);
  if (!data) notFound();
  const { tenant, memberships } = data;

  // Master admin = earliest tenant_admin membership for this tenant.
  const admins = memberships
    .filter((m) => m.role === "tenant_admin")
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  const master = admins[0] ?? null;
  const others = memberships.filter((m) => m.role !== "tenant_admin");

  const allTemplates = await listSectorTemplates();
  const generic =
    (allTemplates.find((t) => t.key === "generic")?.terminology_json as Record<string, string>) ??
    (DEFAULT_TERMINOLOGY as unknown as Record<string, string>);
  const overrides =
    ((tenant.settings_json ?? {}) as Record<string, unknown>).terminology_overrides;
  const initialOverrides =
    overrides && typeof overrides === "object" ? (overrides as Record<string, string>) : {};

  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/platform/tenants" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to tenants
        </Link>
      </div>

      <PageHeading
        title={tenant.name}
        description={`/${tenant.slug}`}
        actions={<StatusBadge status={tenant.status} />}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Tenant details
        </h2>
        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
        >
          <TenantForm
            mode="edit"
            initial={tenant}
            sectorTemplates={allTemplates
              .filter((t) => t.is_active || t.key === tenant.sector_template_key)
              .map((t) => ({ key: t.key, name: t.name }))}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Sector & woordenschat
        </h2>
        <SectorCard
          tenantId={tenant.id}
          initialSectorKey={tenant.sector_template_key}
          initialOverrides={initialOverrides}
          templates={allTemplates
            .filter((t) => t.is_active || t.key === tenant.sector_template_key)
            .map((t) => ({
              key: t.key,
              name: t.name,
              terminology_json: (t.terminology_json ?? {}) as Record<string, string>,
            }))}
          genericTerminology={generic}
        />
      </section>

      <CustomDomainCard
        tenantSlug={tenant.slug}
        currentDomain={tenant.domain}
        apexDomain={process.env.APEX_DOMAIN || "nxttrack.nl"}
        vpsIp={process.env.VPS_PUBLIC_IP || "178.251.232.12"}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Tenant master admin
        </h2>
        <MasterAdminCard
          tenantId={tenant.id}
          currentEmail={master?.profile?.email ?? null}
          currentName={master?.profile?.full_name ?? null}
        />

        {admins.length > 1 && (
          <details className="text-xs" style={{ color: "var(--text-secondary)" }}>
            <summary className="cursor-pointer">
              Other tenant admins ({admins.length - 1})
            </summary>
            <ul className="mt-2 space-y-1 pl-4">
              {admins.slice(1).map((m) => (
                <li key={m.id}>{m.profile?.email ?? m.user_id}</li>
              ))}
            </ul>
          </details>
        )}

        {others.length > 0 && (
          <details className="text-xs" style={{ color: "var(--text-secondary)" }}>
            <summary className="cursor-pointer">
              Other memberships ({others.length})
            </summary>
            <ul className="mt-2 space-y-1 pl-4">
              {others.map((m) => (
                <li key={m.id}>
                  {m.profile?.email ?? m.user_id} — {m.role}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}
