import { notFound, redirect } from "next/navigation";
import { CalendarCheck, CalendarClock, Clock3, Users } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { listInstructorSessions } from "@/lib/db/instructors";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  TrainerCommandHero,
  TrainerEmptyState,
  TrainerListItem,
  TrainerStatusPill,
} from "@/components/public/trainer-shell-components";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

function buildTypeLabels(singular: string): Record<string, string> {
  return {
    primary: `Hoofd${singular.toLowerCase()}`,
    assistant: "Assistent",
    substitute: "Vervanger",
    observer: "Observer",
  };
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default async function PublicAgendaPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/agenda`);

  const terminology = await getTenantTerminology(tenant.id);
  const pageTitle = `Mijn ${terminology.instructor_singular.toLowerCase()}-agenda`;
  const TYPE_LABEL = buildTypeLabels(terminology.instructor_singular);

  const admin = createAdminClient();
  const { data: ownMembers } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id);
  const memberIds = ((ownMembers ?? []) as Array<{ id: string }>).map(
    (m) => m.id,
  );

  const now = Date.now();
  const fromIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const toIso = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString();

  const allSessions = (
    await Promise.all(
      memberIds.map((mid) =>
        listInstructorSessions(tenant.id, mid, { fromIso, toIso }),
      ),
    )
  ).flat();

  const seen = new Set<string>();
  const sessions = allSessions.filter((s) => {
    if (seen.has(s.session_id)) return false;
    seen.add(s.session_id);
    return true;
  });
  const todayCount = sessions.filter((s) => isToday(s.starts_at)).length;
  const groupCount = new Set(sessions.map((s) => s.group_id)).size;

  return (
    <PublicTenantShell tenant={tenant} pageTitle={pageTitle} active="agenda">
      <div className="space-y-4">
        <TrainerCommandHero
          title={pageTitle}
          description="Je lesvloer voor de komende 90 dagen, met snelle toegang tot aanwezigheid en lesbeheer."
          stats={[
            { label: "Vandaag", value: String(todayCount), icon: Clock3 },
            { label: "Sessies", value: String(sessions.length), icon: CalendarCheck },
            { label: "Groepen", value: String(groupCount), icon: Users },
          ]}
        />

        {sessions.length === 0 ? (
          <TrainerEmptyState
            icon={CalendarClock}
            title="Geen sessies"
            body={`Je staat momenteel niet als ${terminology.instructor_singular.toLowerCase()} op aankomende sessies.`}
          />
        ) : (
          <div className="grid gap-3">
            {sessions.map((s) => (
              <TrainerListItem
                key={s.session_id}
                href={`/t/${slug}/schedule/${s.session_id}/manage`}
                title={s.title}
                meta={`${fmt(s.starts_at)} - ${s.group_name}`}
                icon={CalendarCheck}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <TrainerStatusPill toneKey={s.is_explicit ? "accent" : "neutral"}>
                    {TYPE_LABEL[s.assignment_type] ?? s.assignment_type}
                  </TrainerStatusPill>
                  {!s.is_explicit && (
                    <TrainerStatusPill toneKey="info">Impliciet</TrainerStatusPill>
                  )}
                  {isToday(s.starts_at) && (
                    <TrainerStatusPill toneKey="warning">Vandaag</TrainerStatusPill>
                  )}
                </div>
              </TrainerListItem>
            ))}
          </div>
        )}
      </div>
    </PublicTenantShell>
  );
}
