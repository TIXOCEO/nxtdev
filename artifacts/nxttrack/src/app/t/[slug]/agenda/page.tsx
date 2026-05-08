import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { listInstructorSessions } from "@/lib/db/instructors";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { EmptyState } from "@/components/ui/empty-state";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  primary: "Hoofdinstructeur",
  assistant: "Assistent",
  substitute: "Vervanger",
  observer: "Observer",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PublicAgendaPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/agenda`);

  const admin = createAdminClient();
  const { data: ownMembers } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id);
  const memberIds = ((ownMembers ?? []) as Array<{ id: string }>).map((m) => m.id);

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

  // Dedup by session_id (a member shouldn't have two effective rows for same session normally,
  // but defensive against multi-member ownership).
  const seen = new Set<string>();
  const sessions = allSessions.filter((s) => {
    if (seen.has(s.session_id)) return false;
    seen.add(s.session_id);
    return true;
  });

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Mijn instructeurs-agenda" active="agenda">
      <div className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Mijn instructeurs-agenda
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Sessies waarop jij als instructeur staat (komende 90 dagen).
          </p>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Geen sessies"
            description="Je staat momenteel niet als instructeur op aankomende sessies."
          />
        ) : (
          <ul className="grid gap-2">
            {sessions.map((s) => (
              <li
                key={s.session_id}
                className="rounded-2xl border p-3"
                style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/t/${slug}/schedule/${s.session_id}/manage`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {s.title}
                    </Link>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {fmt(s.starts_at)} · {s.group_name}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: s.is_explicit ? "var(--accent)" : "var(--surface-soft)",
                      color: s.is_explicit ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {TYPE_LABEL[s.assignment_type] ?? s.assignment_type}
                    {!s.is_explicit ? " · impliciet" : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicTenantShell>
  );
}
