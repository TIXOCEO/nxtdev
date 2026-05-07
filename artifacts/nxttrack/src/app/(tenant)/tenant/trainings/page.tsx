import Link from "next/link";
import { Calendar, Plus } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTrainingSessionsByTenant } from "@/lib/db/trainings";
import { getTrainingSettingsResolved } from "@/lib/db/training-settings";
import { getTenantTerminology } from "@/lib/terminology/resolver";

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

  return (
    <>
      <PageHeading
        title={terminology.session_plural}
        description={terminology.trainings_page_description}
        actions={
          <Link
            href="/tenant/trainings/new"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> {terminology.trainings_new_button}
          </Link>
        }
      />

      <div
        className="mb-3 rounded-xl border px-3 py-2 text-xs"
        style={{
          backgroundColor: "var(--surface-soft)",
          borderColor: "var(--surface-border)",
          color: "var(--text-secondary)",
        }}
      >
        Auto-herinnering loopt elk uur en stuurt {settings.reminder_hours_before}
        {" "}uur voor de start een melding naar de groep.
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nog geen trainingen"
          description="Plan je eerste training via de knop hierboven."
        />
      ) : (
        <ul className="grid gap-3">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/tenant/trainings/${s.id}`}
                    className="text-sm font-semibold hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {s.title}
                  </Link>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {fmt(s.starts_at)} · {s.group?.name ?? "—"}
                    {s.location ? ` · ${s.location}` : ""}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: "var(--surface-soft)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
