import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { PublicCard } from "./public-card";
import { getSessionsForUser } from "@/lib/db/trainings";

export interface TodayBlockProps {
  tenantId: string;
  tenantSlug: string;
  userId: string;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function TodayBlock({ tenantId, tenantSlug, userId }: TodayBlockProps) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const sessions = await getSessionsForUser(tenantId, userId, {
    fromIso: startOfDay.toISOString(),
  });

  const today = sessions.filter((s) => isSameDay(new Date(s.starts_at), now));
  const next = sessions.find((s) => new Date(s.starts_at) > now && !isSameDay(new Date(s.starts_at), now));

  if (today.length === 0 && !next) return null;

  return (
    <PublicCard className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Vandaag
            </h3>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {today.length === 0
                ? "Geen training vandaag"
                : `${today.length} ${today.length === 1 ? "training" : "trainingen"}`}
            </p>
          </div>
        </div>
        <Link
          href={`/t/${tenantSlug}/schedule`}
          className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          style={{ color: "var(--text-primary)" }}
        >
          Mijn agenda <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {today.length > 0 && (
        <ul className="space-y-1.5">
          {today.slice(0, 3).map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {s.title}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {s.group?.name ?? ""}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                {fmtTime(s.starts_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {next && (
        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Volgende:
          </span>{" "}
          {next.title} · {fmtDate(next.starts_at)} {fmtTime(next.starts_at)}
        </div>
      )}
    </PublicCard>
  );
}
