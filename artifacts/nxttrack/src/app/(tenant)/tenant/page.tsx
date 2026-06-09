import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  FileText,
  Mail,
  Newspaper,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  UsersRound,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  getTenantDashboardOverview,
  getTenantNewsOverview,
  getTenantRegistrationsOverview,
} from "@/lib/db/tenant-admin";
import { getLatestPublishedRelease, hasUserSeenRelease } from "@/lib/db/releases";
import { LatestReleaseCard } from "@/components/tenant/release-card";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import {
  TenantAdminActionLink,
  TenantAdminBars,
  TenantAdminHero,
  TenantAdminListItem,
  TenantAdminMetric,
  TenantAdminSectionHeader,
  TenantAdminSegmentChart,
  TenantAdminSurface,
} from "@/components/tenant/tenant-backoffice-components";

export const dynamic = "force-dynamic";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default async function TenantDashboardPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const tenantId = result.tenant.id;
  const [overview, news, regs, latestRelease, terminology] = await Promise.all([
    getTenantDashboardOverview(tenantId),
    getTenantNewsOverview(tenantId, 4),
    getTenantRegistrationsOverview(tenantId, 4),
    getLatestPublishedRelease(),
    getTenantTerminology(tenantId),
  ]);
  const latestReleaseUnseen = latestRelease
    ? !(await hasUserSeenRelease(result.user.id, latestRelease.version).catch(() => true))
    : false;

  const stats = overview.stats;

  return (
    <>
      <TenantAdminHero
        title={`Welkom terug, ${result.tenant.name}`}
        description="Een operationeel overzicht van instroom, leden, planning en communicatie. Gebouwd voor snel scannen en meteen doorpakken."
        action={
          <div className="flex flex-wrap gap-2">
            <TenantAdminActionLink href="/tenant/members" icon={Users}>
              Leden beheren
            </TenantAdminActionLink>
            <Link
              href="/tenant/news/new"
              className="nxt-focus-ring nxt-shell-soft-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
            >
              <Plus className="h-4 w-4" />
              Bericht maken
            </Link>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TenantAdminMetric
            label={terminology.member_plural}
            value={stats.membersActive}
            hint={`${stats.membersArchived} in archief`}
            icon={Users}
            tone="success"
          />
          <TenantAdminMetric
            label="Nieuwe aanmeldingen"
            value={stats.registrationsNew}
            hint={`${stats.registrationsTotal} totaal`}
            icon={ClipboardList}
            tone="warning"
          />
          <TenantAdminMetric
            label="Vandaag gepland"
            value={stats.sessionsToday}
            hint={`${stats.sessionsUpcoming} aankomend`}
            icon={CalendarCheck}
            tone="info"
          />
          <TenantAdminMetric
            label={terminology.group_plural}
            value={stats.groupsTotal}
            hint={`${stats.newsPublished} publicaties live`}
            icon={UsersRound}
          />
        </div>
      </TenantAdminHero>

      <LatestReleaseCard release={latestRelease} isUnseen={latestReleaseUnseen} />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <TenantAdminSurface className="p-4 sm:p-5">
          <TenantAdminSectionHeader
            title="Groei en instroom"
            description="Nieuwe aanmeldingen en aangemaakte leden over de afgelopen zes maanden."
          />
          <TenantAdminBars data={overview.registrationTrend} />
          <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--tenant-accent, var(--accent))" }} />
              Aanmeldingen
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--brand-navy)" }} />
              Nieuwe leden
            </span>
          </div>
        </TenantAdminSurface>

        <div className="grid gap-4">
          <TenantAdminSurface className="p-4 sm:p-5">
            <TenantAdminSectionHeader title="Ledenstatus" />
            <div className="mt-4">
              <TenantAdminSegmentChart data={overview.memberStatus} />
            </div>
          </TenantAdminSurface>
          <TenantAdminSurface className="p-4 sm:p-5">
            <TenantAdminSectionHeader title="Instroomstatus" />
            <div className="mt-4">
              <TenantAdminSegmentChart data={overview.registrationStatus} />
            </div>
          </TenantAdminSurface>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <TenantAdminSurface className="overflow-hidden xl:col-span-1">
          <div className="border-b p-4 sm:p-5" style={{ borderColor: "var(--shell-border)" }}>
            <TenantAdminSectionHeader
              title="Aankomende lessen"
              action={
                <Link href="/tenant/trainings" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Alles
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
          </div>
          {overview.upcomingSessions.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={CalendarCheck}
                title="Geen aankomende lessen"
                description="Nieuwe sessies verschijnen hier zodra ze gepland zijn."
              />
            </div>
          ) : (
            <div className="grid gap-2 p-3">
              {overview.upcomingSessions.map((session) => (
                <TenantAdminListItem
                  key={session.id}
                  href={`/tenant/trainings/${session.id}`}
                  icon={CalendarCheck}
                  title={session.title || session.group_name || "Sessie"}
                  meta={`${fmtDateTime(session.starts_at)}${session.location ? ` - ${session.location}` : ""}`}
                />
              ))}
            </div>
          )}
        </TenantAdminSurface>

        <TenantAdminSurface className="overflow-hidden xl:col-span-1">
          <div className="border-b p-4 sm:p-5" style={{ borderColor: "var(--shell-border)" }}>
            <TenantAdminSectionHeader
              title="Aanmeldingen"
              action={
                <Link href="/tenant/registrations" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Intake
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
          </div>
          {regs.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ClipboardList}
                title="Geen aanmeldingen"
                description="Aanmeldingen verschijnen hier zodra de publieke flow live is."
              />
            </div>
          ) : (
            <div className="grid gap-2 p-3">
              {regs.map((registration) => (
                <TenantAdminListItem
                  key={registration.id}
                  href="/tenant/registrations"
                  icon={ClipboardList}
                  title={`${registration.parent_name} - ${registration.child_name}`}
                  meta={`${registration.parent_email} - ${fmtDate(registration.created_at)}`}
                >
                  <StatusBadge status={registration.status} />
                </TenantAdminListItem>
              ))}
            </div>
          )}
        </TenantAdminSurface>

        <TenantAdminSurface className="overflow-hidden xl:col-span-1">
          <div className="border-b p-4 sm:p-5" style={{ borderColor: "var(--shell-border)" }}>
            <TenantAdminSectionHeader
              title="Publicatie"
              action={
                <Link href="/tenant/news" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Nieuws
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
          </div>
          {news.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Newspaper}
                title="Nog geen nieuws"
                description="Maak je eerste bericht voor de publieke site en leden."
                action={
                  <Link
                    href="/tenant/news/new"
                    className="nxt-shell-primary-button inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nieuw bericht
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="grid gap-2 p-3">
              {news.map((post) => (
                <TenantAdminListItem
                  key={post.id}
                  href={`/tenant/news/${post.id}`}
                  icon={Newspaper}
                  title={post.title}
                  meta={fmtDate(post.created_at)}
                >
                  <StatusBadge status={post.status} />
                </TenantAdminListItem>
              ))}
            </div>
          )}
        </TenantAdminSurface>
      </div>

      <TenantAdminSurface className="p-4 sm:p-5">
        <TenantAdminSectionHeader
          title="Snelle beheeracties"
          description="De meest gebruikte backoffice taken, logisch gegroepeerd voor dagelijks beheer."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/tenant/intake", label: "Intake beoordelen", icon: Sparkles },
            { href: "/tenant/groups", label: "Groepen inrichten", icon: UsersRound },
            { href: "/tenant/communication", label: "Communicatie sturen", icon: Mail },
            { href: "/tenant/settings", label: "Tenant instellingen", icon: Settings },
            { href: "/tenant/pages", label: "Website pagina's", icon: FileText },
            { href: "/tenant/programmas", label: "Programma's beheren", icon: Sparkles },
            { href: "/tenant/memberships", label: "Abonnementen", icon: ClipboardList },
            { href: "/tenant/audit", label: "Audit-log", icon: ShieldCheck },
          ].map((action) => (
            <TenantAdminListItem
              key={action.href}
              href={action.href}
              icon={action.icon}
              title={action.label}
              meta="Open beheer"
            />
          ))}
        </div>
      </TenantAdminSurface>
    </>
  );
}
