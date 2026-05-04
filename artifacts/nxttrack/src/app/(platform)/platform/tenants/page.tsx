import Link from "next/link";
import { Building2, Plus, Pencil } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getAllTenants } from "@/lib/db/platform-tenants";
import { TenantStatusToggle } from "./_status-toggle";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function TenantsListPage() {
  const tenants = await getAllTenants();

  return (
    <>
      <PageHeading
        title="Tenants"
        description="All tenants on the platform."
        actions={
          <Link
            href="/platform/tenants/new"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> New tenant
          </Link>
        }
      />

      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No tenants yet"
          description="Create your first tenant to get started."
          action={
            <Link
              href="/platform/tenants/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <Plus className="h-4 w-4" /> New tenant
            </Link>
          }
        />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                  <th className="px-5 py-3">Tenant</th>
                  <th className="px-5 py-3">Slug</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                {tenants.map((t) => (
                  <tr key={t.id} style={{ color: "var(--text-primary)" }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                          style={{ backgroundColor: t.primary_color || "var(--surface-soft)" }}
                        >
                          {t.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
                          )}
                        </div>
                        <span className="font-medium">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      /{t.slug}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {t.contact_email ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {formatDate(t.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <TenantStatusToggle id={t.id} status={t.status} />
                        <Link
                          href={`/platform/tenants/${t.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
