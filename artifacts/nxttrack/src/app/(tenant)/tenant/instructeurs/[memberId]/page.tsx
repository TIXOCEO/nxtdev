import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  getInstructorMember,
  listAvailability,
  listUnavailability,
  listInstructorSessions,
} from "@/lib/db/instructors";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { AvailabilityForm } from "./_availability-form";
import { UnavailabilityForm } from "./_unavailability-form";
import { AvailabilityRow } from "./_availability-row";
import { UnavailabilityRow } from "./_unavailability-row";

interface PageProps {
  params: Promise<{ memberId: string }>;
}

export const dynamic = "force-dynamic";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InstructorDetailPage({ params }: PageProps) {
  const { memberId } = await params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const member = await getInstructorMember(result.tenant.id, memberId);
  if (!member) notFound();

  const nowIso = new Date().toISOString();
  const horizonIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const [availability, unavailability, sessions, terminology] = await Promise.all([
    listAvailability(result.tenant.id, memberId),
    listUnavailability(result.tenant.id, memberId, nowIso),
    listInstructorSessions(result.tenant.id, memberId, { fromIso: nowIso, toIso: horizonIso }),
    getTenantTerminology(result.tenant.id),
  ]);

  return (
    <>
      <Link
        href="/tenant/instructeurs"
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar {terminology.instructor_plural.toLowerCase()}
      </Link>

      <PageHeading title={member.full_name} description={member.email ?? "—"} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="rounded-2xl border p-4"
          style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
        >
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Wekelijkse beschikbaarheid
          </h2>
          {availability.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Nog geen beschikbaarheid ingevuld.
            </p>
          ) : (
            <ul className="mb-4 grid gap-1.5 text-xs">
              {availability.map((a) => (
                <AvailabilityRow
                  key={a.id}
                  tenantId={result.tenant.id}
                  row={{
                    id: a.id,
                    day_of_week: a.day_of_week,
                    start_time: a.start_time,
                    end_time: a.end_time,
                    availability_type: a.availability_type,
                    notes: a.notes,
                  }}
                />
              ))}
            </ul>
          )}
          <AvailabilityForm tenantId={result.tenant.id} memberId={memberId} />
        </section>

        <section
          className="rounded-2xl border p-4"
          style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
        >
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Afwezigheid (datum-specifiek)
          </h2>
          {unavailability.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Geen toekomstige afwezigheid.
            </p>
          ) : (
            <ul className="mb-4 grid gap-1.5 text-xs">
              {unavailability.map((u) => (
                <UnavailabilityRow
                  key={u.id}
                  tenantId={result.tenant.id}
                  row={{
                    id: u.id,
                    starts_at: u.starts_at,
                    ends_at: u.ends_at,
                    reason: u.reason,
                    notes: u.notes,
                  }}
                />
              ))}
            </ul>
          )}
          <UnavailabilityForm tenantId={result.tenant.id} memberId={memberId} />
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Aankomende sessies (90 dagen)
        </h2>
        {sessions.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Geen aankomende sessies.
          </p>
        ) : (
          <ul className="grid gap-2">
            {sessions.map((s) => (
              <li
                key={`${s.session_id}-${s.assignment_type}`}
                className="rounded-xl border px-3 py-2"
                style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/tenant/trainings/${s.session_id}`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {s.title}
                    </Link>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {fmtDateTime(s.starts_at)} · {s.group_name}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: s.is_explicit ? "var(--accent)" : "var(--surface-soft)",
                      color: s.is_explicit ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {s.assignment_type}{!s.is_explicit ? " · impliciet" : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
