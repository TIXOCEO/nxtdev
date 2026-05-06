import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { trainerInSessionGroup } from "@/lib/auth/trainer-rules";
import {
  getTrainingSessionById,
  getAttendanceForSession,
} from "@/lib/db/trainings";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { TrainerManageClient } from "./_manage-client";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TrainerManageSessionPage({ params }: PageProps) {
  const { slug, id } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/schedule/${id}/manage`);

  const auth = await trainerInSessionGroup(tenant.id, user.id, id);
  if (!auth) redirect(`/t/${slug}/schedule/${id}`);

  const session = await getTrainingSessionById(tenant.id, id);
  if (!session) notFound();

  const attendance = await getAttendanceForSession(tenant.id, id);

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Manage" active="agenda">
      <div className="space-y-3 pb-32">
        <Link
          href={`/t/${slug}/schedule/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug
        </Link>

        <header
          className="rounded-2xl border p-3"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {session.title}
          </h1>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {fmt(session.starts_at)}
            {session.location ? ` · ${session.location}` : ""}
          </p>
        </header>

        <TrainerManageClient
          tenantId={tenant.id}
          tenantSlug={slug}
          sessionId={id}
          rows={attendance.map((a) => ({
            id: a.id,
            memberId: a.member_id,
            memberName: a.member?.full_name ?? "—",
            currentMark: a.attendance ?? null,
            currentRsvp: a.rsvp ?? null,
            currentNote: a.note ?? a.trainer_note ?? a.notes ?? "",
            currentNoteVisibility:
              a.note_visibility === "member" || a.note_visibility === "private"
                ? a.note_visibility
                : a.trainer_note
                  ? "private"
                  : a.notes
                    ? "member"
                    : "private",
            currentAbsenceReason: a.absence_reason ?? null,
            rsvpReasonText: a.attendance_reason ?? null,
          }))}
        />
      </div>
    </PublicTenantShell>
  );
}
