import {
  Award,
  CalendarDays,
  ClipboardCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Tenant } from "@/types/database";
import {
  getUserTenantContext,
  isAthlete,
  isParent,
  isTrainer,
} from "@/lib/auth/user-role-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { listDiplomasForMembers } from "@/lib/db/child-diplomas";
import {
  UserActionLink,
  UserJourneyTrack,
  UserMetricCard,
  UserSectionHeader,
  UserStatusPill,
  UserSurface,
} from "./user-shell-components";

interface UserHomeDashboardProps {
  tenant: Tenant;
  userId: string;
}

interface SessionSummary {
  title: string;
  starts_at: string;
  location: string | null;
}

function displayName(member: { first_name: string | null; last_name: string | null }) {
  return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "Lid";
}

export async function UserHomeDashboard({ tenant, userId }: UserHomeDashboardProps) {
  const ctx = await getUserTenantContext(tenant.id, userId);
  const hasSportRole = isParent(ctx) || isAthlete(ctx);
  const hasTrainerRole = isTrainer(ctx);

  if (!hasSportRole && !hasTrainerRole) return null;

  const visibleMembers = [...ctx.members, ...ctx.children];
  const memberIds = visibleMembers.map((m) => m.id);
  const admin = createAdminClient();

  let nextSession: SessionSummary | null = null;
  let progressCount = 0;
  let diplomaCount = 0;

  if (memberIds.length > 0) {
    const { data: memberships } = await admin
      .from("group_members")
      .select("group_id")
      .eq("tenant_id", tenant.id)
      .in("member_id", memberIds);

    const groupIds = Array.from(
      new Set(((memberships ?? []) as Array<{ group_id: string }>).map((r) => r.group_id)),
    );

    if (groupIds.length > 0) {
      const { data: sessions } = await admin
        .from("training_sessions")
        .select("title, starts_at, location")
        .eq("tenant_id", tenant.id)
        .in("group_id", groupIds)
        .gte("starts_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true })
        .limit(1);
      nextSession = ((sessions ?? []) as SessionSummary[])[0] ?? null;
    }

    const [{ count }, diplomas] = await Promise.all([
      admin
        .from("training_attendance")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .in("member_id", memberIds)
        .not("skill_level", "is", null),
      listDiplomasForMembers(tenant.id, memberIds),
    ]);
    progressCount = count ?? 0;
    diplomaCount = diplomas.length;
  }

  const nextDate = nextSession ? new Date(nextSession.starts_at) : null;
  const steps = [
    { label: "Intake", state: "done" as const },
    { label: "Plaatsing", state: memberIds.length > 0 ? ("done" as const) : ("current" as const) },
    { label: "Lessen", state: nextSession ? ("current" as const) : ("locked" as const) },
    { label: "Voortgang", state: progressCount > 0 ? ("current" as const) : ("locked" as const) },
    { label: "Diploma", state: diplomaCount > 0 ? ("done" as const) : ("locked" as const) },
  ];

  return (
    <UserSurface className="overflow-hidden p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <UserSectionHeader
            eyebrow={hasTrainerRole ? "Mijn portaal" : "Mijn zwemreis"}
            title={hasTrainerRole ? `Welkom terug bij ${tenant.name}` : "Overzicht voor vandaag"}
            description="Je belangrijkste lessen, voortgang en acties bij elkaar."
            icon={Sparkles}
            action={<UserActionLink href={`/t/${tenant.slug}/lessen`}>Mijn lessen</UserActionLink>}
          />

          {visibleMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {visibleMembers.slice(0, 6).map((member) => (
                <UserStatusPill key={member.id} toneKey="accent" icon={Users}>
                  {displayName(member)}
                </UserStatusPill>
              ))}
            </div>
          )}

          <UserJourneyTrack steps={steps} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <UserMetricCard
            label="Volgende les"
            value={
              nextDate
                ? nextDate.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" })
                : "Nog niet"
            }
            helper={
              nextSession
                ? `${nextDate?.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}${nextSession.location ? ` - ${nextSession.location}` : ""}`
                : "Geen aankomende les gevonden"
            }
            icon={CalendarDays}
            toneKey={nextSession ? "accent" : "neutral"}
          />
          <UserMetricCard
            label="Voortgang"
            value={progressCount > 0 ? `${progressCount}` : "Start"}
            helper={progressCount > 0 ? "Recente skillmomenten" : "Nog geen beoordelingen"}
            icon={TrendingUp}
            toneKey={progressCount > 0 ? "success" : "neutral"}
          />
          <UserMetricCard
            label="Diploma's"
            value={diplomaCount > 0 ? `${diplomaCount}` : "0"}
            helper={diplomaCount > 0 ? "Beschikbaar in de kluis" : "Nog niets toegekend"}
            icon={Award}
            toneKey={diplomaCount > 0 ? "success" : "neutral"}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-3" style={{ borderColor: "var(--shell-border)" }}>
        <UserActionLink href={`/t/${tenant.slug}/voortgang`} icon={TrendingUp}>
          Bekijk voortgang
        </UserActionLink>
        <UserActionLink href={`/t/${tenant.slug}/diplomas`} icon={Award}>
          Diploma's
        </UserActionLink>
        <UserActionLink href={`/t/${tenant.slug}/inschrijven`} icon={ClipboardCheck}>
          Nieuwe intake
        </UserActionLink>
      </div>
    </UserSurface>
  );
}
