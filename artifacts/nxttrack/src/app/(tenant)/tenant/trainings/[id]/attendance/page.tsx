import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, CheckCircle2, Users } from "lucide-react";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTrainingSessionDetail } from "@/lib/db/trainings";
import {
  TenantAdminHero,
  TenantAdminMetric,
  TenantAdminSurface,
} from "@/components/tenant/tenant-backoffice-components";
import { AttendanceMarkRow } from "./_mark-row";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AttendancePage({ params }: PageProps) {
  const { id } = await params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const detail = await getTrainingSessionDetail(id, result.tenant.id);
  if (!detail) notFound();

  const markedCount = detail.attendance.filter((a) => a.attendance).length;
  const presentCount = detail.attendance.filter((a) => a.attendance === "present").length;

  return (
    <>
      <Link
        href={`/tenant/trainings/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Terug naar training
      </Link>

      <TenantAdminHero
        eyebrow="Training"
        title="Aanwezigheid opnemen"
        description={`${detail.session.title} - markeer per atleet present, te laat, afwezig of geblesseerd.`}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <TenantAdminMetric
            label="Deelnemers"
            value={detail.attendance.length}
            hint="Gekoppeld aan deze training"
            icon={Users}
            tone="info"
          />
          <TenantAdminMetric
            label="Gemarkeerd"
            value={markedCount}
            hint={`${Math.max(0, detail.attendance.length - markedCount)} nog open`}
            icon={CheckCircle2}
            tone="success"
          />
          <TenantAdminMetric
            label="Aanwezig"
            value={presentCount}
            hint="Actueel opgeslagen"
            icon={CalendarCheck}
          />
        </div>
      </TenantAdminHero>

      {detail.attendance.length === 0 ? (
        <TenantAdminSurface className="p-5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>
            Geen leden gekoppeld aan deze training.
          </span>
        </TenantAdminSurface>
      ) : (
        <ul className="grid gap-3">
          {detail.attendance.map((a) => (
            <AttendanceMarkRow
              key={a.id}
              tenantId={result.tenant.id}
              sessionId={id}
              memberId={a.member_id}
              memberName={a.member?.full_name ?? "-"}
              currentRsvp={a.rsvp ?? null}
              currentMark={a.attendance ?? null}
              currentNote={a.note ?? a.trainer_note ?? a.notes ?? ""}
              currentNoteVisibility={
                (a.note_visibility === "member" || a.note_visibility === "private"
                  ? a.note_visibility
                  : a.trainer_note
                    ? "private"
                    : a.notes
                      ? "member"
                      : "private") as "private" | "member"
              }
              currentAbsenceReason={a.absence_reason ?? null}
              rsvpReasonText={a.attendance_reason ?? null}
            />
          ))}
        </ul>
      )}
    </>
  );
}
