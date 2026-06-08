import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, Users } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { trainerInSessionGroup } from "@/lib/auth/trainer-rules";
import {
  getTrainingSessionById,
  getAttendanceForSession,
} from "@/lib/db/trainings";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  TrainerCommandHero,
  TrainerStatusPill,
} from "@/components/public/trainer-shell-components";
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
  const marked = attendance.filter((a) => !!a.attendance).length;

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Lesbeheer" active="agenda">
      <div className="space-y-4 pb-32">
        <Link
          href={`/t/${slug}/schedule/${id}`}
          className="nxt-focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar les
        </Link>

        <TrainerCommandHero
          title={session.title}
          eyebrow="Lesbeheer"
          description="Tik aanwezigheid snel af, voeg waar nodig een notitie toe en open direct het leerlingdossier."
          stats={[
            { label: "Leerlingen", value: String(attendance.length), icon: Users },
            { label: "Gemarkeerd", value: `${marked}/${attendance.length}`, icon: CheckCircle2 },
            { label: "Start", value: fmt(session.starts_at), icon: Clock3 },
          ]}
          action={
            session.location ? (
              <TrainerStatusPill toneKey="neutral" icon={MapPin}>
                {session.location}
              </TrainerStatusPill>
            ) : null
          }
        />

        <TrainerManageClient
          tenantId={tenant.id}
          tenantSlug={slug}
          sessionId={id}
          rows={attendance.map((a) => ({
            id: a.id,
            memberId: a.member_id,
            memberName: a.member?.full_name ?? "-",
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
