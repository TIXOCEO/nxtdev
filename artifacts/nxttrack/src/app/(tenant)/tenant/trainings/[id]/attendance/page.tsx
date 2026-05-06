import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTrainingSessionDetail } from "@/lib/db/trainings";
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

  return (
    <>
      <Link
        href={`/tenant/trainings/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar training
      </Link>

      <PageHeading
        title="Aanwezigheid"
        description={`${detail.session.title} — markeer per atleet present, te laat, afwezig of geblesseerd.`}
      />

      {detail.attendance.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Geen leden gekoppeld aan deze training.
        </p>
      ) : (
        <ul
          className="divide-y rounded-2xl border"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--surface-main)",
          }}
        >
          {detail.attendance.map((a) => (
            <AttendanceMarkRow
              key={a.id}
              tenantId={result.tenant.id}
              sessionId={id}
              memberId={a.member_id}
              memberName={a.member?.full_name ?? "—"}
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
