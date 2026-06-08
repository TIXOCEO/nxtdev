import Link from "next/link";
import { Calendar, CalendarCheck, Clock, MapPin, Plus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTrainingSessionsByTenant } from "@/lib/db/trainings";
import { getTrainingSettingsResolved } from "@/lib/db/training-settings";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import {
  TenantAdminActionLink,
  TenantAdminHero,
  TenantAdminMetric,
  TenantAdminSurface,
} from "@/components/tenant/tenant-backoffice-components";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Gepland",
  cancelled: "Geannuleerd",
  completed: "Afgerond",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TenantTrainingsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [sessions, settings, terminology] = await Promise.all([
    getTrainingSessionsByTenant(result.tenant.id),
    getTrainingSettingsResolved(result.tenant.id),
    getTenantTerminology(result.tenant.id),
  ]);
  const scheduled = sessions.filter((s) => s.status === "scheduled").length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const cancelled = sessions.filter((s) => s.status === "cancelled").length;

  return (
    <>
      <TenantAdminHero
        title={terminology.session_plural}
        description={terminology.trainings_page_description}
        action={
          <TenantAdminActionLink href="/tenant/trainings/new" icon={Plus}>
            {terminology.trainings_new_button}
          </TenantAdminActionLink>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TenantAdminMetric
            label="Sessies"
            value={sessions.length}
            hint="Totaal zichtbaar"
            icon={Calendar}
            tone="info"
          />
          <TenantAdminMetric
            label="Gepland"
            value={scheduled}
            hint="Aankomende lessen"
            icon={CalendarCheck}
            tone="success"
          />
          <TenantAdminMetric
            label="Afgerond"
            value={completed}
            hint="Historie"
            icon={UsersRound}
          />
          <TenantAdminMetric
            label="Geannuleerd"
            value={cancelled}
            hint="Niet doorgegaan"
            icon={Clock}
            tone={cancelled > 0 ? "warning" : "neutral"}
          />
        </div>
      </TenantAdminHero>

      <TenantAdminSurface className="mb-3 flex items-center gap-2 p-3 text-xs">
        <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--shell-info)" }} />
        <span style={{ color: "var(--text-secondary)" }}>
          Auto-herinnering loopt elk uur en stuurt {settings.reminder_hours_before} uur voor de start een melding naar de groep.
        </span>
      </TenantAdminSurface>

      {sessions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nog geen trainingen"
          description="Plan je eerste training via de knop hierboven."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sessions.map((s) => (
            <TenantAdminSurface key={s.id} className="p-4" interactive>
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
                  style={{
                    borderColor: "var(--shell-border)",
                    backgroundColor: "color-mix(in srgb, var(--shell-info) 9%, var(--shell-panel-muted))",
                    color: "var(--shell-info)",
                  }}
                >
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tenant/trainings/${s.id}`}
                    className="text-sm font-semibold hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {s.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {fmt(s.starts_at)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UsersRound className="h-3.5 w-3.5" />
                      {s.group?.name ?? "-"}
                    </span>
                    {s.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {s.location}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: "var(--shell-panel-muted)",
                    color: s.status === "scheduled" ? "var(--shell-success)" : "var(--text-secondary)",
                  }}
                >
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
            </TenantAdminSurface>
          ))}
        </div>
      )}
    </>
  );
}
