import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTrainingSessionDetail } from "@/lib/db/trainings";
import { listSessionInstructorsExplicit, listSessionInstructorsEffective, listInstructors } from "@/lib/db/instructors";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { TrainingStatusActions } from "./_status-actions";
import { ReminderButton } from "./_reminder-button";
import { SessionInstructorsBlock } from "./_instructors-block";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Gepland",
  cancelled: "Geannuleerd",
  completed: "Afgerond",
};
const RSVP_LABEL: Record<string, string> = {
  attending: "Aanwezig",
  not_attending: "Afwezig",
  maybe: "Misschien",
};
const ATT_LABEL: Record<string, string> = {
  present: "Aanwezig",
  absent: "Afwezig",
  late: "Te laat",
  injured: "Geblesseerd",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TrainingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const detail = await getTrainingSessionDetail(id, result.tenant.id);
  if (!detail) notFound();

  const [explicitInstructors, effectiveInstructors, allInstructors, terminology] = await Promise.all([
    listSessionInstructorsExplicit(result.tenant.id, id),
    listSessionInstructorsEffective(result.tenant.id, id),
    // Eligible: alle leden met de trainer-rol binnen deze tenant. We staan
    // bewust toe een trainer toe te wijzen die niet in de groep zit (bv.
    // vervangers uit een andere groep / poule).
    listInstructors(result.tenant.id),
    getTenantTerminology(result.tenant.id),
  ]);
  const eligibleMap = new Map<string, { id: string; full_name: string }>();
  for (const t of allInstructors) {
    eligibleMap.set(t.member_id, { id: t.member_id, full_name: t.full_name });
  }
  // Houd reeds-toegewezen leden ook in de lijst zelfs als ze (nog) geen
  // trainer-rol meer hebben — anders kan je ze niet meer verwijderen via UI.
  for (const e of explicitInstructors) {
    if (!eligibleMap.has(e.member_id)) {
      eligibleMap.set(e.member_id, { id: e.member_id, full_name: e.full_name });
    }
  }
  const eligibleInstructors = Array.from(eligibleMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name, "nl"));

  const counts = detail.attendance.reduce(
    (acc, a) => {
      if (a.rsvp === "attending") acc.attending++;
      else if (a.rsvp === "not_attending") acc.notAttending++;
      else if (a.rsvp === "maybe") acc.maybe++;
      else acc.noResponse++;
      return acc;
    },
    { attending: 0, notAttending: 0, maybe: 0, noResponse: 0 },
  );

  return (
    <>
      <Link
        href="/tenant/trainings"
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar trainingen
      </Link>

      <PageHeading
        title={detail.session.title}
        description={`${fmt(detail.session.starts_at)} — ${fmt(detail.session.ends_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/tenant/trainings/${id}/attendance`}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <ClipboardList className="h-4 w-4" /> Aanwezigheid
            </Link>
          </div>
        }
      />

      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>
            Groep: <strong style={{ color: "var(--text-primary)" }}>{detail.group?.name ?? "—"}</strong>
          </span>
          <span style={{ color: "var(--text-secondary)" }}>
            Status: <strong style={{ color: "var(--text-primary)" }}>{STATUS_LABEL[detail.session.status] ?? detail.session.status}</strong>
          </span>
          {detail.session.location && (
            <span style={{ color: "var(--text-secondary)" }}>
              Locatie: <strong style={{ color: "var(--text-primary)" }}>{detail.session.location}</strong>
            </span>
          )}
        </div>
        {detail.session.description && (
          <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            {detail.session.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TrainingStatusActions
            tenantId={result.tenant.id}
            sessionId={id}
            status={detail.session.status}
          />
          <ReminderButton tenantId={result.tenant.id} sessionId={id} />
        </div>
      </div>

      <SessionInstructorsBlock
        tenantId={result.tenant.id}
        sessionId={id}
        explicit={explicitInstructors}
        effective={effectiveInstructors}
        eligible={eligibleInstructors}
        labels={{ singular: terminology.instructor_singular, plural: terminology.instructor_plural }}
      />

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Reacties ({detail.attendance.length})
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          {counts.attending} aanwezig · {counts.notAttending} afwezig · {counts.maybe} misschien ·{" "}
          {counts.noResponse} geen reactie
        </p>
        {detail.attendance.length > 0 && (
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--surface-border)" }}>
            {detail.attendance.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {a.member?.full_name ?? "—"}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    Reactie: {a.rsvp ? RSVP_LABEL[a.rsvp] ?? a.rsvp : "—"}
                    {a.rsvp_late ? " · laat" : ""}
                    {a.attendance ? ` · Markering: ${ATT_LABEL[a.attendance] ?? a.attendance}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
