import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import {
  getSessionsForUser,
  getAttendanceForUser,
} from "@/lib/db/trainings";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { RsvpRow } from "./_rsvp";

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

export default async function PublicSessionDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/schedule/${id}`);

  const all = await getSessionsForUser(tenant.id, user.id);
  const session = all.find((s) => s.id === id);
  if (!session) notFound();

  const memberIds = session.forMembers.map((m) => m.id);
  const attendance = await getAttendanceForUser(tenant.id, id, memberIds);
  const rsvpByMember = new Map(attendance.map((a) => [a.member_id, a]));

  const canRespond = session.status === "scheduled";
  const isTrainer = session.viewerRole === "trainer";

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Training" active="agenda">
      <div className="space-y-4">
        <Link
          href={`/t/${slug}/schedule`}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar agenda
        </Link>

        <header
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {session.title}
              </h1>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {fmt(session.starts_at)} — {fmt(session.ends_at)}
                {session.location ? ` · ${session.location}` : ""}
              </p>
            </div>
            {isTrainer && session.status === "scheduled" && (
              <Link
                href={`/t/${slug}/schedule/${id}/manage`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Manage training
              </Link>
            )}
          </div>
          {session.description && (
            <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              {session.description}
            </p>
          )}
        </header>

        {!isTrainer && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Reactie per persoon
            </h2>
            {!canRespond && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Deze training accepteert geen reacties meer.
              </p>
            )}
            <ul className="grid gap-2">
              {session.forMembers.map((m) => {
                const a = rsvpByMember.get(m.id);
                return (
                  <RsvpRow
                    key={m.id}
                    tenantId={tenant.id}
                    sessionId={id}
                    memberId={m.id}
                    memberName={m.full_name}
                    currentRsvp={a?.rsvp ?? null}
                    currentReason={a?.absence_reason ?? null}
                    currentReasonText={a?.attendance_reason ?? null}
                    trainerNote={
                      a?.note_visibility === "member" ? a?.note ?? null : null
                    }
                    disabled={!canRespond}
                  />
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </PublicTenantShell>
  );
}
