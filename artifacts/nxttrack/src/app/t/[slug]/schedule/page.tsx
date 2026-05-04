import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getSessionsForUser } from "@/lib/db/trainings";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { AgendaStatusStrip } from "@/components/public/agenda-status-strip";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Gepland",
  cancelled: "Geannuleerd",
  completed: "Afgerond",
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

export default async function PublicSchedulePage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/schedule`);

  const sessions = await getSessionsForUser(tenant.id, user.id, {
    fromIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  });
  const now = Date.now();
  const stats = {
    total: sessions.length,
    upcoming: sessions.filter(
      (s) => new Date(s.starts_at).getTime() >= now && s.status !== "cancelled",
    ).length,
    cancelled: sessions.filter((s) => s.status === "cancelled").length,
  };

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Agenda" active="agenda">
      <div className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Mijn trainingen
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Trainingen voor jou en je gekoppelde kinderen.
          </p>
        </div>

        {sessions.length > 0 && (
          <AgendaStatusStrip
            total={stats.total}
            upcoming={stats.upcoming}
            cancelled={stats.cancelled}
          />
        )}

        {sessions.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Geen geplande trainingen"
            description="Zodra een training voor jouw groep gepland wordt, zie je die hier."
          />
        ) : (
          <ul className="grid gap-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border p-3"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/t/${slug}/schedule/${s.id}`}
                      className="text-sm font-semibold hover:underline"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {s.title}
                    </Link>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {fmt(s.starts_at)} · {s.group?.name ?? ""}
                      {s.location ? ` · ${s.location}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      Voor: {s.forMembers.map((m) => m.full_name).join(", ")}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
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
