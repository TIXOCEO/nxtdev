import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isParent, isAthlete } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { PageHeader } from "@/components/public/page-header";
import { createAdminClient } from "@/lib/supabase/admin";

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
const LEVEL_TONE: Record<string, { bg: string; text: string }> = {
  none:     { bg: "#f3f4f6", text: "#6b7280" },
  practice: { bg: "#fef3c7", text: "#92400e" },
  almost:   { bg: "#fed7aa", text: "#9a3412" },
  good:     { bg: "#d1fae5", text: "#065f46" },
  mastered: { bg: "#dcfce7", text: "#14532d" },
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

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Voortgang" active="voortgang">
      <PageHeader
        title="Voortgang"
        description="Beoordelingen van skills uit recente trainingen."
      />
      {entries.length === 0 ? (
        <PublicCard className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--accent-tint)", color: "var(--brand-navy)" }}
            >
              <TrendingUp className="h-7 w-7" />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Nog geen voortgang
            </h2>
            <p className="max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
              Zodra een trainer een skill beoordeelt verschijnt die hier per lid.
            </p>
          </div>
        </PublicCard>
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(byMember.entries()).map(([memberId, list]) => (
            <div key={memberId} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                {memberNames.get(memberId)}
              </h3>
              <PublicCard>
                <div className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                  {list.slice(0, 12).map((e, i) => {
                    const tone = LEVEL_TONE[e.skill_level] ?? LEVEL_TONE.none;
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {e.session_title}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            {new Date(e.starts_at).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <span
                          className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold"
                          style={{ backgroundColor: tone.bg, color: tone.text }}
                        >
                          {LEVEL_LABEL[e.skill_level] ?? e.skill_level}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </PublicCard>
            </div>
          ))}
        </div>
      )}
    </PublicTenantShell>
  );
}
