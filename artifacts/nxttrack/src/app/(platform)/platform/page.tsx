import Link from "next/link";
import { Building2, CheckCircle2, PauseCircle, Inbox, Plus } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/platform/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getAllTenants,
  getPlatformOverviewStats,
} from "@/lib/db/platform-tenants";

export const dynamic = "force-dynamic";

export default async function PlatformDashboardPage() {
  const [stats, tenants] = await Promise.all([
    getPlatformOverviewStats(),
    getAllTenants(),
  ]);
  const recent = tenants.slice(0, 5);

  return (
    <>
      <PageHeading
        title="Platform overview"
        description="Welcome back. Manage tenants and monitor activity from here."
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tenants"    value={stats.total}         icon={Building2} />
        <StatCard label="Active tenants"   value={stats.active}        icon={CheckCircle2} />
        <StatCard label="Inactive tenants" value={stats.inactive}      icon={PauseCircle} />
        <StatCard label="Registrations"    value={stats.registrations} icon={Inbox} />
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Recent tenants
          </h2>
          <Link
            href="/platform/tenants"
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--text-secondary)" }}
          >
            View all →
          </Link>
        </div>

        {recent.length === 0 ? (
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
            <ul className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/platform/tenants/${t.id}`} className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                      style={{ backgroundColor: t.primary_color || "var(--surface-soft)" }}
                    >
                      {t.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {t.name}
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                        /{t.slug}
                      </p>
                    </div>
                  </Link>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-center text-xs" style={{ color: "var(--text-secondary)" }}>
        Modules (news, registrations, athletes…) are coming in later sprints.
      </p>
    </>
  );
}
