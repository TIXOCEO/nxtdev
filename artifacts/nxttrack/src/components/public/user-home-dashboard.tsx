import {
  Award,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
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
  UserReferenceHero,
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

  const familyName = visibleMembers[0]?.last_name
    ? `Familie ${visibleMembers[0].last_name}`
    : tenant.name;

  return (
    <div className="space-y-4">
      <UserReferenceHero
        eyebrow={hasTrainerRole ? "Welkom terug" : "Welkom terug,"}
        title={hasTrainerRole ? `Trainerportaal ${tenant.name}` : familyName}
        description={hasTrainerRole ? "Je lesvloer, groepen en acties staan klaar." : "Waar staat je kind nu in de zwemreis?"}
        action={<UserActionLink href={`/t/${tenant.slug}/voortgang`}>Bekijk voortgang</UserActionLink>}
      >
        {visibleMembers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleMembers.slice(0, 5).map((member, index) => (
              <UserStatusPill key={member.id} toneKey={index === 0 ? "accent" : "neutral"} icon={Users}>
                {displayName(member)}
              </UserStatusPill>
            ))}
          </div>
        )}
      </UserReferenceHero>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
          <UserMetricCard
            label="Huidig niveau"
            value={diplomaCount > 0 ? "Diploma A" : "Start"}
            helper={diplomaCount > 0 ? "In de diploma kluis" : "Zwemreis gestart"}
            icon={Award}
            toneKey="info"
          />
          <UserMetricCard
            label="Eerstvolgende les"
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
            label="Plaatsingsstatus"
            value={memberIds.length > 0 ? "Bevestigd" : "Open"}
            helper={memberIds.length > 0 ? "Wekelijks ingepland" : "Nog geen plaatsing"}
            icon={CheckCircle2}
            toneKey={memberIds.length > 0 ? "success" : "warning"}
          />
          <UserMetricCard
            label="Belangrijkste actie"
            value={progressCount > 0 ? `${progressCount}` : "Start"}
            helper={progressCount > 0 ? "Bekijk voortgang" : "Start met eerste les"}
            icon={TrendingUp}
            toneKey={progressCount > 0 ? "success" : "neutral"}
          />
        </div>

        <UserSurface className="p-4 lg:row-span-2">
          <UserSectionHeader
            title="Bijna klaar!"
            description={diplomaCount > 0 ? "Je diploma staat klaar." : "Nog een paar onderdelen te gaan."}
            icon={Sparkles}
          />
          <div className="mt-4 rounded-2xl p-4" style={{ background: "linear-gradient(135deg, var(--brand-navy), #0b63ff)", color: "#ffffff" }}>
            <p className="text-sm font-semibold opacity-90">Klaar voor</p>
            <p className="mt-1 text-2xl font-bold">Diploma A</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25">
              <span className="block h-full rounded-full bg-[#78c90f]" style={{ width: `${Math.min(78, 35 + progressCount * 4)}%` }} />
            </div>
            <p className="mt-2 text-xs opacity-85">{Math.min(78, 35 + progressCount * 4)}% afgerond</p>
          </div>
        </UserSurface>

        <UserSurface className="p-4 lg:col-span-2">
          <UserSectionHeader title="Zwemreis" description="Van watergewenning naar diploma's." icon={TrendingUp} />
          <div className="mt-4">
            <UserJourneyTrack steps={steps} />
          </div>
        </UserSurface>

        <UserSurface className="p-4">
          <UserSectionHeader title="Skills overzicht" icon={Sparkles} />
          <div className="mt-4 space-y-3">
            {[
              ["Drijven", 90],
              ["Ruglig", 75],
              ["Voortbewegen", 80],
              ["Onder water", 60],
            ].map(([label, value]) => (
              <div key={label as string} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
                <span style={{ color: "var(--text-primary)" }}>{label}</span>
                <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{value}%</span>
                <div className="nxt-shell-progress col-span-2 h-1.5">
                  <span style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </UserSurface>

        <UserSurface className="p-4">
          <UserSectionHeader title="Snel naar" icon={Sparkles} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { href: `/t/${tenant.slug}/lessen`, label: "Lessen", icon: CalendarDays },
              { href: `/t/${tenant.slug}/voortgang`, label: "Voortgang", icon: TrendingUp },
              { href: `/t/${tenant.slug}/diplomas`, label: "Diploma's", icon: Award },
              { href: `/t/${tenant.slug}/messages`, label: "Berichten", icon: MessageSquare },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.href} href={item.href} className="nxt-focus-ring rounded-2xl border p-3 text-center text-xs font-semibold transition-transform hover:-translate-y-0.5" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)", color: "var(--text-primary)" }}>
                  <Icon className="mx-auto mb-2 h-4 w-4" style={{ color: "var(--shell-info)" }} />
                  {item.label}
                </a>
              );
            })}
          </div>
        </UserSurface>

        <div className="grid gap-3 lg:col-span-2 sm:grid-cols-3">
          <UserActionLink href={`/t/${tenant.slug}/lessen`} icon={CalendarDays}>Lesdetails</UserActionLink>
          <UserActionLink href={`/t/${tenant.slug}/diplomas`} icon={Award}>Diploma's</UserActionLink>
          <UserActionLink href={`/t/${tenant.slug}/inschrijven`} icon={ClipboardCheck}>Nieuwe intake</UserActionLink>
        </div>
      </div>
    </div>
  );
}
