import Link from "next/link";
import {
  Newspaper,
  CheckCircle2,
  PencilLine,
  ClipboardList,
  Plus,
  Users,
  UserCog,
  CalendarCheck,
  TrendingUp,
} from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { TenantStatCard } from "@/components/tenant/tenant-stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  getTenantDashboardStats,
  getTenantNewsOverview,
  getTenantRegistrationsOverview,
} from "@/lib/db/tenant-admin";
import { getLatestPublishedRelease, hasUserSeenRelease } from "@/lib/db/releases";
import { LatestReleaseCard } from "@/components/tenant/release-card";

export const dynamic = "force-dynamic";

const COMING_SOON = [
  { label: "Players", icon: Users, hint: "Manage athletes and teams." },
  { label: "Trainers", icon: UserCog, hint: "Coach roster and assignments." },
  { label: "Attendance", icon: CalendarCheck, hint: "Track session attendance." },
  { label: "Development tracking", icon: TrendingUp, hint: "Player progress over time." },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function TenantDashboardPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null; // layout handled

  const tenantId = result.tenant.id;
  const [stats, news, regs, latestRelease] = await Promise.all([
    getTenantDashboardStats(tenantId),
    getTenantNewsOverview(tenantId, 5),
    getTenantRegistrationsOverview(tenantId, 5),
    getLatestPublishedRelease(),
  ]);
  const latestReleaseUnseen = latestRelease
    ? !(await hasUserSeenRelease(result.user.id, latestRelease.version).catch(() => true))
    : false;

  return (
    <>
      <PageHeading
        title={`Welcome, ${result.tenant.name}`}
        description="Your tenant workspace at a glance."
        actions={
          <Link
            href="/tenant/news/new"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> New post
          </Link>
        }
      />

      <LatestReleaseCard release={latestRelease} isUnseen={latestReleaseUnseen} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <TenantStatCard label="News posts"   value={stats.newsTotal}          icon={Newspaper} />
        <TenantStatCard label="Published"    value={stats.newsPublished}      icon={CheckCircle2} />
        <TenantStatCard label="Drafts"       value={stats.newsDrafts}         icon={PencilLine} />
        <TenantStatCard label="Registrations" value={stats.registrationsTotal} icon={ClipboardList} hint={`${stats.registrationsNew} new`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Recent news
            </h2>
            <Link href="/tenant/news" className="text-sm font-medium hover:underline" style={{ color: "var(--text-secondary)" }}>
              View all →
            </Link>
          </div>
          {news.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No posts yet"
              description="Write your first announcement."
              action={
                <Link
                  href="/tenant/news/new"
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold"
                  style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                >
                  <Plus className="h-3.5 w-3.5" /> New post
                </Link>
              }
            />
          ) : (
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
            >
              <ul className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                {news.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <Link href={`/tenant/news/${p.id}`} className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {p.title}
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                        {fmtDate(p.created_at)}
                      </p>
                    </Link>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Recent registrations
            </h2>
            <Link href="/tenant/registrations" className="text-sm font-medium hover:underline" style={{ color: "var(--text-secondary)" }}>
              View all →
            </Link>
          </div>
          {regs.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No registrations yet"
              description="Sign-ups will appear here once your public form is live."
            />
          ) : (
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
            >
              <ul className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                {regs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {r.parent_name} <span style={{ color: "var(--text-secondary)" }}>· {r.child_name}</span>
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                        {r.parent_email} · {fmtDate(r.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Coming soon
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMING_SOON.map((m) => (
            <div
              key={m.label}
              className="flex flex-col gap-2 rounded-2xl border border-dashed p-4"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: "var(--surface-soft)",
              }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--bg-app)", color: "var(--text-secondary)" }}
              >
                <m.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {m.label}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {m.hint}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
