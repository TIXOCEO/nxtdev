import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarCheck, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isParent, isAthlete } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  UserEmptyState,
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
  return { title: `${tenant.name} | Mijn lessen` };
}

export default async function LessenPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/lessen`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  if (!isParent(ctx) && !isAthlete(ctx)) redirect(`/t/${slug}`);

  const memberIds = [...ctx.members.map((m) => m.id), ...ctx.children.map((c) => c.id)];
  const memberNames = new Map<string, string>();
  for (const m of [...ctx.members, ...ctx.children]) {
    memberNames.set(m.id, `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Lid");
  }

  const admin = createAdminClient();
  let sessions: Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location: string | null;
    status: string;
    group_id: string;
    member_name: string;
  }> = [];

  if (memberIds.length > 0) {
    const { data: gms } = await admin
      .from("group_members")
      .select("member_id, group_id")
      .eq("tenant_id", tenant.id)
      .in("member_id", memberIds);
    const groupIdToMembers = new Map<string, string[]>();
    for (const gm of (gms ?? []) as Array<{ member_id: string; group_id: string }>) {
      const list = groupIdToMembers.get(gm.group_id) ?? [];
      list.push(gm.member_id);
      groupIdToMembers.set(gm.group_id, list);
    }
    const groupIds = Array.from(groupIdToMembers.keys());
    if (groupIds.length > 0) {
      const sinceIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: ss } = await admin
        .from("training_sessions")
        .select("id, title, starts_at, ends_at, location, status, group_id")
        .eq("tenant_id", tenant.id)
        .in("group_id", groupIds)
        .gte("starts_at", sinceIso)
        .order("starts_at", { ascending: true })
        .limit(40);
      sessions = ((ss ?? []) as Array<{
        id: string;
        title: string;
        starts_at: string;
        ends_at: string;
        location: string | null;
        status: string;
        group_id: string;
      }>).map((s) => {
        const mids = groupIdToMembers.get(s.group_id) ?? [];
        const name = mids.map((id) => memberNames.get(id)).filter(Boolean).join(", ") || "Lid";
        return { ...s, member_name: name };
      });
    }
  }

  const now = Date.now();
  const upcoming = sessions.filter((s) => new Date(s.starts_at).getTime() >= now);
  const past = sessions.filter((s) => new Date(s.starts_at).getTime() < now).reverse();

  function row(s: (typeof sessions)[number]) {
    const d = new Date(s.starts_at);
    const cancelled = s.status === "cancelled";
    return (
      <div key={s.id} className="flex items-start gap-3 px-4 py-3">
        <div
          className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-center"
          style={{ backgroundColor: "var(--accent-tint)", borderColor: "var(--shell-border)", color: "var(--brand-navy)" }}
        >
          <span className="text-[10px] font-semibold uppercase">
            {d.toLocaleDateString("nl-NL", { month: "short" })}
          </span>
          <span className="text-base font-bold leading-none">{d.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-medium ${cancelled ? "line-through opacity-60" : ""}`}
            style={{ color: "var(--text-primary)" }}
          >
            {s.title}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {s.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {s.location}
              </span>
            )}
            <span>{s.member_name}</span>
          </p>
        </div>
        {cancelled ? (
          <UserStatusPill toneKey="danger">Geannuleerd</UserStatusPill>
        ) : (
          <UserStatusPill toneKey="accent">Gepland</UserStatusPill>
        )}
      </div>
    );
  }

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Mijn lessen" active="lessen">
      <UserSectionHeader
        eyebrow="Agenda"
        title="Mijn lessen"
        description="Aankomende en recente trainingen voor jou en je kinderen."
        icon={CalendarDays}
      />
      {sessions.length === 0 ? (
        <UserEmptyState
          icon={CalendarDays}
          title="Geen lessen gepland"
          body="Zodra er een groep is toegewezen en sessies gepland zijn verschijnen ze hier."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <UserMetricCard
              label="Aankomend"
              value={`${upcoming.length}`}
              helper="Geplande lessen"
              icon={CalendarCheck}
              toneKey={upcoming.length > 0 ? "accent" : "neutral"}
            />
            <UserMetricCard
              label="Recent"
              value={`${past.length}`}
              helper="Afgelopen 30 dagen"
              icon={CalendarDays}
              toneKey="neutral"
            />
            <UserMetricCard
              label="Leerlingen"
              value={`${memberIds.length}`}
              helper="In dit overzicht"
              icon={Users}
              toneKey="info"
            />
          </div>

          {upcoming.length > 0 && (
            <div className="flex flex-col gap-2">
              <UserSectionHeader eyebrow="Timeline" title="Aankomend" icon={CalendarCheck} />
              <UserSurface>
                <div className="divide-y" style={{ borderColor: "var(--shell-border)" }}>
                  {upcoming.map(row)}
                </div>
              </UserSurface>
            </div>
          )}
          {past.length > 0 && (
            <div className="flex flex-col gap-2">
              <UserSectionHeader eyebrow="Historie" title="Recent" icon={CalendarDays} />
              <UserSurface>
                <div className="divide-y" style={{ borderColor: "var(--shell-border)" }}>
                  {past.slice(0, 10).map(row)}
                </div>
              </UserSurface>
            </div>
          )}
        </div>
      )}
    </PublicTenantShell>
  );
}
