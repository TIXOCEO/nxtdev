import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  UserActionLink,
  UserEmptyState,
  UserMetricCard,
  UserSectionHeader,
  UserStatusPill,
  UserSurface,
} from "./user-shell-components";

export {
  UserActionLink as TrainerActionLink,
  UserEmptyState as TrainerEmptyState,
  UserMetricCard as TrainerMetricCard,
  UserSectionHeader as TrainerSectionHeader,
  UserStatusPill as TrainerStatusPill,
  UserSurface as TrainerSurface,
};

export function TrainerCommandHero({
  title,
  description,
  eyebrow = "Trainerportaal",
  action,
  stats,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
  stats?: Array<{ label: string; value: string; icon: LucideIcon }>;
}) {
  return (
    <UserSurface className="overflow-hidden p-0">
      <div className="relative p-5 sm:p-6 lg:p-7">
        <div
          aria-hidden
          className="absolute -right-20 -top-24 h-56 w-56 rounded-full blur-3xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--tenant-accent) 34%, transparent)" }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <UserSectionHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
            icon={CalendarCheck}
          />
          {action}
        </div>
        {stats && stats.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-2xl border px-4 py-3 shadow-sm"
                  style={{
                    backgroundColor: "var(--shell-panel-muted)",
                    borderColor: "var(--shell-border)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--shell-info)" }} />
                    <p
                      className="truncate text-xs font-semibold uppercase"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {stat.label}
                    </p>
                  </div>
                  <p
                    className="mt-1 text-2xl font-bold tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </UserSurface>
  );
}

export function TrainerListItem({
  href,
  title,
  meta,
  children,
  icon: Icon = CircleDashed,
}: {
  href?: string;
  title: string;
  meta?: string;
  children?: ReactNode;
  icon?: LucideIcon;
}) {
  const content = (
    <div className="flex min-w-0 items-start gap-3 p-4">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
        style={{
          borderColor: "var(--shell-border)",
          backgroundColor: "color-mix(in srgb, var(--tenant-accent) 14%, var(--shell-panel-strong))",
          color: "var(--shell-info)",
        }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </p>
            {meta && (
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {meta}
              </p>
            )}
          </div>
          {href && (
            <ArrowRight
              className="mt-1 h-4 w-4 shrink-0"
              style={{ color: "var(--text-secondary)" }}
            />
          )}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );

  if (!href) {
    return (
      <UserSurface className="overflow-hidden" interactive>
        {content}
      </UserSurface>
    );
  }

  return (
    <Link
      href={href}
      className={cn("block rounded-[18px]", "nxt-focus-ring")}
    >
      <UserSurface className="overflow-hidden" interactive>
        {content}
      </UserSurface>
    </Link>
  );
}

export function TrainerProgressBar({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex min-w-[160px] items-center gap-2">
      <div className="nxt-shell-progress h-2 flex-1">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--tenant-accent), var(--shell-info))",
          }}
        />
      </div>
      <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
        {done}/{total}
      </span>
    </div>
  );
}

export function trainerMarkTone(mark: string | null) {
  if (mark === "present") return { label: "Aanwezig", toneKey: "success" as const, icon: CheckCircle2 };
  if (mark === "absent") return { label: "Afwezig", toneKey: "danger" as const, icon: CircleDashed };
  if (mark === "late") return { label: "Te laat", toneKey: "warning" as const, icon: Timer };
  if (mark === "injured") return { label: "Blessure", toneKey: "warning" as const, icon: CircleDashed };
  return { label: "Open", toneKey: "neutral" as const, icon: CircleDashed };
}
