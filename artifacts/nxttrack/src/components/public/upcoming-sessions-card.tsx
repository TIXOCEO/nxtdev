import { CalendarDays } from "lucide-react";
import { PublicCard } from "./public-card";
import type { PublicUpcomingSession } from "@/lib/db/tenant-events";

interface UpcomingSessionsCardProps {
  sessions: PublicUpcomingSession[];
}

function fmtDay(iso: string): { label: string; tone: "today" | "tomorrow" | "later" } {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round(
    (startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (diff === 0) return { label: "Vandaag", tone: "today" };
  if (diff === 1) return { label: "Morgen", tone: "tomorrow" };
  return {
    label: d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }),
    tone: "later",
  };
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UpcomingSessionsCard({ sessions }: UpcomingSessionsCardProps) {
  if (sessions.length === 0) {
    return (
      <PublicCard className="flex h-full flex-col gap-3 p-5 sm:p-6">
        <Header />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Er staan momenteel geen sessies gepland in de komende twee weken.
        </p>
      </PublicCard>
    );
  }

  return (
    <PublicCard className="flex h-full flex-col gap-3 p-5 sm:p-6">
      <Header />
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {sessions.map((s) => {
          const day = fmtDay(s.starts_at);
          return (
            <li
              key={s.session_id}
              className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: "var(--surface-soft, var(--surface-main))",
              }}
            >
              <div
                className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold uppercase"
                style={{
                  backgroundColor:
                    day.tone === "today"
                      ? "var(--tenant-accent)"
                      : "color-mix(in srgb, var(--tenant-accent) 18%, transparent)",
                  color: "var(--text-primary)",
                }}
              >
                <span className="leading-tight">{day.label.split(" ")[0]}</span>
                {day.tone === "later" && (
                  <span className="text-[9px] opacity-70">
                    {day.label.split(" ")[1] ?? ""}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.title || s.group_name || "Training"}
                </p>
                <p
                  className="truncate text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {fmtTime(s.starts_at)}
                  {s.group_name ? ` · ${s.group_name}` : ""}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </PublicCard>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
          color: "var(--text-primary)",
        }}
      >
        <CalendarDays className="h-5 w-5" />
      </div>
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Aankomende sessies
        </h3>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          De eerstvolgende trainingen — komende 14 dagen.
        </p>
      </div>
    </div>
  );
}
