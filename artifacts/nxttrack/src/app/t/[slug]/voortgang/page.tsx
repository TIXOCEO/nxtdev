import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Award, CheckCircle2, Sparkles, Target, TrendingUp } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isParent, isAthlete } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  UserBadgeTile,
  UserEmptyState,
  UserJourneyTrack,
  UserMetricCard,
  UserSectionHeader,
  UserStatusPill,
  UserSurface,
} from "@/components/public/user-shell-components";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  return { title: `${tenant.name} | Voortgang` };
}

const LEVEL_LABEL: Record<string, string> = {
  none: "Nog niet gestart",
  practice: "Oefenen",
  almost: "Bijna",
  good: "Goed",
  mastered: "Beheerst",
};
const LEVEL_SCORE: Record<string, number> = {
  none: 0,
  practice: 1,
  almost: 2,
  good: 3,
  mastered: 4,
};

interface ProgressEntry {
  member_id: string;
  member_name: string;
  skill_level: string;
  session_title: string;
  starts_at: string;
}

export default async function VoortgangPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/voortgang`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  if (!isParent(ctx) && !isAthlete(ctx)) redirect(`/t/${slug}`);

  // Collect all member ids this user can act for (own members + children).
  const memberIds = [
    ...ctx.members.map((m) => m.id),
    ...ctx.children.map((c) => c.id),
  ];
  const memberNames = new Map<string, string>();
  for (const m of [...ctx.members, ...ctx.children]) {
    memberNames.set(m.id, `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Lid");
  }

  let entries: ProgressEntry[] = [];
  if (memberIds.length > 0) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("training_attendance")
      .select("member_id, skill_level, session_id, training_sessions(title, starts_at)")
      .eq("tenant_id", tenant.id)
      .in("member_id", memberIds)
      .not("skill_level", "is", null)
      .order("session_id", { ascending: false })
      .limit(50);
    type Row = {
      member_id: string;
      skill_level: string;
      training_sessions:
        | { title: string; starts_at: string }
        | Array<{ title: string; starts_at: string }>
        | null;
    };
    const flat = (r: Row) =>
      Array.isArray(r.training_sessions) ? r.training_sessions[0] ?? null : r.training_sessions;
    entries = ((data ?? []) as unknown as Row[])
      .map((r) => ({ r, ts: flat(r) }))
      .filter((x): x is { r: Row; ts: { title: string; starts_at: string } } => x.ts !== null)
      .map(({ r, ts }) => ({
        member_id: r.member_id,
        member_name: memberNames.get(r.member_id) ?? "Lid",
        skill_level: r.skill_level,
        session_title: ts.title,
        starts_at: ts.starts_at,
      }))
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  }

  // Group by member.
  const byMember = new Map<string, ProgressEntry[]>();
  for (const e of entries) {
    const list = byMember.get(e.member_id) ?? [];
    list.push(e);
    byMember.set(e.member_id, list);
  }

  const masteredCount = entries.filter((e) => e.skill_level === "mastered").length;
  const strongCount = entries.filter((e) => ["good", "mastered"].includes(e.skill_level)).length;
  const bestScore = entries.reduce(
    (score, e) => Math.max(score, LEVEL_SCORE[e.skill_level] ?? 0),
    0,
  );

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Voortgang" active="voortgang">
      <UserSectionHeader
        eyebrow="Mijn zwemreis"
        title="Voortgang"
        description="Een positief overzicht van recente skillmomenten, mijlpalen en de volgende stap."
        icon={TrendingUp}
      />
      {entries.length === 0 ? (
        <UserEmptyState
          icon={TrendingUp}
          title="Nog geen voortgang"
          body="Zodra een trainer een skill beoordeelt verschijnt die hier per lid."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <UserMetricCard
              label="Skillmomenten"
              value={`${entries.length}`}
              helper="Recente beoordelingen"
              icon={Sparkles}
              toneKey="accent"
            />
            <UserMetricCard
              label="Sterk of beheerst"
              value={`${strongCount}`}
              helper="Positieve mijlpalen"
              icon={CheckCircle2}
              toneKey={strongCount > 0 ? "success" : "neutral"}
            />
            <UserMetricCard
              label="Beheerst"
              value={`${masteredCount}`}
              helper="Klaar om vast te houden"
              icon={Award}
              toneKey={masteredCount > 0 ? "success" : "neutral"}
            />
          </div>

          <UserSurface className="p-5">
            <UserSectionHeader
              eyebrow="Zwemreis"
              title="Waar staan we nu?"
              description="De status is gebaseerd op de meest recente skillmomenten."
              icon={Target}
            />
            <div className="mt-4">
              <UserJourneyTrack
                steps={[
                  { label: "Start", state: bestScore >= 1 ? "done" : "current" },
                  { label: "Oefenen", state: bestScore >= 2 ? "done" : bestScore === 1 ? "current" : "locked" },
                  { label: "Bijna", state: bestScore >= 3 ? "done" : bestScore === 2 ? "current" : "locked" },
                  { label: "Goed", state: bestScore >= 4 ? "done" : bestScore === 3 ? "current" : "locked" },
                  { label: "Beheerst", state: bestScore >= 4 ? "current" : "locked" },
                ]}
              />
            </div>
          </UserSurface>

          <div className="grid gap-3 sm:grid-cols-3">
            <UserBadgeTile
              title="Eerste splash"
              subtitle="Eerste beoordeling ontvangen"
              unlocked={entries.length > 0}
            />
            <UserBadgeTile
              title="Goed bezig"
              subtitle="Een skill staat op goed of hoger"
              unlocked={strongCount > 0}
            />
            <UserBadgeTile
              title="Beheerst"
              subtitle="Een skill is volledig beheerst"
              unlocked={masteredCount > 0}
            />
          </div>

          {Array.from(byMember.entries()).map(([memberId, list]) => (
            <div key={memberId} className="flex flex-col gap-2">
              <UserSectionHeader
                eyebrow="Leerling"
                title={memberNames.get(memberId) ?? "Lid"}
                description={`${list.length} recente skillmomenten`}
                icon={Sparkles}
              />
              <UserSurface>
                <div className="divide-y" style={{ borderColor: "var(--shell-border)" }}>
                  {list.slice(0, 12).map((e, i) => {
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {e.session_title}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            {new Date(e.starts_at).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <UserStatusPill
                          toneKey={
                            e.skill_level === "mastered" || e.skill_level === "good"
                              ? "success"
                              : e.skill_level === "almost"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {LEVEL_LABEL[e.skill_level] ?? e.skill_level}
                        </UserStatusPill>
                      </div>
                    );
                  })}
                </div>
              </UserSurface>
            </div>
          ))}
        </div>
      )}
    </PublicTenantShell>
  );
}
