import { createClient } from "@/lib/supabase/server";
import type { NewsPost, Registration } from "@/types/database";

export interface TenantDashboardStats {
  newsTotal: number;
  newsPublished: number;
  newsDrafts: number;
  registrationsTotal: number;
  registrationsNew: number;
  membersTotal: number;
  membersActive: number;
  membersArchived: number;
  groupsTotal: number;
  sessionsUpcoming: number;
  sessionsToday: number;
}

export interface TenantDashboardTrendPoint {
  label: string;
  registrations: number;
  members: number;
}

export interface TenantDashboardStatusPoint {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral";
}

export interface TenantDashboardUpcomingSession {
  id: string;
  title: string | null;
  starts_at: string;
  location: string | null;
  group_name: string | null;
}

export interface TenantDashboardOverview {
  stats: TenantDashboardStats;
  registrationTrend: TenantDashboardTrendPoint[];
  memberStatus: TenantDashboardStatusPoint[];
  registrationStatus: TenantDashboardStatusPoint[];
  upcomingSessions: TenantDashboardUpcomingSession[];
}

export async function getTenantDashboardStats(
  tenantId: string,
): Promise<TenantDashboardStats> {
  const supabase = await createClient();

  const today = new Date();
  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(today);
  dayEnd.setHours(23, 59, 59, 999);

  const [
    newsTotal,
    newsPub,
    newsDraft,
    regTotal,
    regNew,
    membersTotal,
    membersActive,
    membersArchived,
    groupsTotal,
    sessionsUpcoming,
    sessionsToday,
  ] = await Promise.all([
    supabase
      .from("news_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("news_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "published"),
    supabase
      .from("news_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "draft"),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "new"),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("archived_at", null),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("archived_at", "is", null),
    supabase
      .from("groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("training_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("starts_at", new Date().toISOString()),
    supabase
      .from("training_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("starts_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString()),
  ]);

  return {
    newsTotal: newsTotal.count ?? 0,
    newsPublished: newsPub.count ?? 0,
    newsDrafts: newsDraft.count ?? 0,
    registrationsTotal: regTotal.count ?? 0,
    registrationsNew: regNew.count ?? 0,
    membersTotal: membersTotal.count ?? 0,
    membersActive: membersActive.count ?? 0,
    membersArchived: membersArchived.count ?? 0,
    groupsTotal: groupsTotal.count ?? 0,
    sessionsUpcoming: sessionsUpcoming.count ?? 0,
    sessionsToday: sessionsToday.count ?? 0,
  };
}

export async function getTenantDashboardOverview(
  tenantId: string,
): Promise<TenantDashboardOverview> {
  const supabase = await createClient();
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [stats, registrations, members, upcoming] = await Promise.all([
    getTenantDashboardStats(tenantId),
    supabase
      .from("registrations")
      .select("id, status, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", sixMonthsAgo.toISOString()),
    supabase
      .from("members")
      .select("id, member_status, archived_at, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", sixMonthsAgo.toISOString()),
    supabase
      .from("training_sessions")
      .select("id, title, starts_at, location, group:groups(name)")
      .eq("tenant_id", tenantId)
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
  ]);

  if (registrations.error) {
    throw new Error(`Failed to fetch registration trend: ${registrations.error.message}`);
  }
  if (members.error) {
    throw new Error(`Failed to fetch member trend: ${members.error.message}`);
  }
  if (upcoming.error) {
    throw new Error(`Failed to fetch upcoming sessions: ${upcoming.error.message}`);
  }

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString(undefined, { month: "short" }),
      registrations: 0,
      members: 0,
    };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));

  for (const row of (registrations.data ?? []) as Array<{ created_at: string }>) {
    const date = new Date(row.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const point = byKey.get(key);
    if (point) point.registrations += 1;
  }

  type MemberTrendRow = {
    member_status: string | null;
    archived_at: string | null;
    created_at: string;
  };
  const memberRows = (members.data ?? []) as MemberTrendRow[];
  for (const row of memberRows) {
    const date = new Date(row.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const point = byKey.get(key);
    if (point) point.members += 1;
  }

  const activeMembers = memberRows.filter((m) => !m.archived_at);
  const memberStatus = [
    {
      label: "Actief",
      value: activeMembers.filter((m) => m.member_status === "active").length,
      tone: "success" as const,
    },
    {
      label: "Concept",
      value: activeMembers.filter((m) => m.member_status === "draft").length,
      tone: "warning" as const,
    },
    {
      label: "Overig",
      value: activeMembers.filter((m) => !["active", "draft"].includes(m.member_status ?? "")).length,
      tone: "neutral" as const,
    },
    {
      label: "Archief",
      value: stats.membersArchived,
      tone: "danger" as const,
    },
  ];

  const regRows = (registrations.data ?? []) as Array<{ status: string | null }>;
  const registrationStatus = [
    {
      label: "Nieuw",
      value: regRows.filter((r) => r.status === "new").length,
      tone: "warning" as const,
    },
    {
      label: "In review",
      value: regRows.filter((r) => r.status === "review").length,
      tone: "neutral" as const,
    },
    {
      label: "Geplaatst",
      value: regRows.filter((r) => r.status === "converted").length,
      tone: "success" as const,
    },
    {
      label: "Afgewezen",
      value: regRows.filter((r) => r.status === "rejected").length,
      tone: "danger" as const,
    },
  ];

  type UpcomingRow = {
    id: string;
    title: string | null;
    starts_at: string;
    location: string | null;
    group: { name: string } | { name: string }[] | null;
  };

  return {
    stats,
    registrationTrend: months.map(({ label, registrations: reg, members: mem }) => ({
      label,
      registrations: reg,
      members: mem,
    })),
    memberStatus,
    registrationStatus,
    upcomingSessions: ((upcoming.data ?? []) as UpcomingRow[]).map((row) => {
      const group = Array.isArray(row.group) ? (row.group[0] ?? null) : row.group;
      return {
        id: row.id,
        title: row.title,
        starts_at: row.starts_at,
        location: row.location,
        group_name: group?.name ?? null,
      };
    }),
  };
}

export async function getTenantNewsOverview(
  tenantId: string,
  limit = 5,
): Promise<NewsPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch news overview: ${error.message}`);
  return (data ?? []) as NewsPost[];
}

export async function getTenantRegistrationsOverview(
  tenantId: string,
  limit = 5,
): Promise<Registration[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error)
    throw new Error(`Failed to fetch registrations overview: ${error.message}`);
  return (data ?? []) as Registration[];
}
