import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  Lock,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "info" | "warning" | "danger";

const tone: Record<Tone, { bg: string; text: string; border: string }> = {
  neutral: {
    bg: "var(--shell-panel-muted)",
    text: "var(--text-secondary)",
    border: "var(--shell-border)",
  },
  accent: {
    bg: "color-mix(in srgb, var(--tenant-accent) 18%, var(--shell-panel-strong))",
    text: "var(--brand-navy)",
    border: "color-mix(in srgb, var(--tenant-accent) 34%, transparent)",
  },
  success: {
    bg: "color-mix(in srgb, var(--shell-success) 12%, var(--shell-panel-strong))",
    text: "var(--shell-success)",
    border: "color-mix(in srgb, var(--shell-success) 26%, transparent)",
  },
  info: {
    bg: "color-mix(in srgb, var(--shell-info) 10%, var(--shell-panel-strong))",
    text: "var(--shell-info)",
    border: "color-mix(in srgb, var(--shell-info) 22%, transparent)",
  },
  warning: {
    bg: "color-mix(in srgb, var(--shell-warning) 12%, var(--shell-panel-strong))",
    text: "var(--shell-warning)",
    border: "color-mix(in srgb, var(--shell-warning) 26%, transparent)",
  },
  danger: {
    bg: "color-mix(in srgb, var(--shell-danger) 10%, var(--shell-panel-strong))",
    text: "var(--shell-danger)",
    border: "color-mix(in srgb, var(--shell-danger) 24%, transparent)",
  },
};

export function UserSurface({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <section
      className={cn(
        "nxt-shell-surface nxt-shell-enter rounded-[18px]",
        interactive && "nxt-shell-hover",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function UserSectionHeader({
  eyebrow,
  title,
  description,
  action,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
            style={{
              borderColor: "var(--shell-border)",
              backgroundColor: "color-mix(in srgb, var(--tenant-accent) 14%, var(--shell-panel-strong))",
              color: "var(--brand-navy)",
            }}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-secondary)" }}>
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-secondary)" }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function UserStatusPill({
  children,
  toneKey = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  toneKey?: Tone;
  icon?: LucideIcon;
}) {
  const t = tone[toneKey];
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: t.bg, borderColor: t.border, color: t.text }}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function UserMetricCard({
  label,
  value,
  helper,
  icon: Icon,
  toneKey = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  toneKey?: Tone;
}) {
  const t = tone[toneKey];
  return (
    <UserSurface className="p-4" interactive>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-secondary)" }}>
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {value}
          </p>
          {helper && <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{helper}</p>}
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm" style={{ backgroundColor: t.bg, borderColor: t.border, color: t.text }}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </UserSurface>
  );
}

export function UserReferenceHero({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <UserSurface className="relative overflow-hidden p-5 sm:p-6 lg:p-7">
      <div
        aria-hidden
        className="absolute -right-16 -top-20 h-52 w-52 rounded-full blur-3xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--tenant-accent) 34%, transparent)" }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-8 hidden h-28 w-48 rounded-t-full sm:block"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--tenant-accent) 22%, transparent), transparent)",
        }}
      />
      <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            {eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 sm:text-base" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="relative mt-5">{children}</div> : null}
    </UserSurface>
  );
}

export function UserEmptyState({
  icon: Icon = Sparkles,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <UserSurface className="p-8">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border" style={{ borderColor: "var(--shell-border)", backgroundColor: "color-mix(in srgb, var(--tenant-accent) 16%, var(--shell-panel-strong))", color: "var(--brand-navy)" }}>
          <Icon className="h-7 w-7" />
        </span>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{body}</p>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </UserSurface>
  );
}

export function UserActionLink({
  href,
  children,
  icon: Icon = ArrowRight,
}: {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Link href={href} className="nxt-focus-ring nxt-shell-primary-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5">
      <span>{children}</span>
      <Icon className="h-4 w-4" />
    </Link>
  );
}

export function UserJourneyTrack({
  steps,
}: {
  steps: Array<{ label: string; state: "done" | "current" | "locked" }>;
}) {
  return (
    <div className="relative grid gap-3 sm:grid-cols-5">
      {steps.map((step, index) => {
        const done = step.state === "done";
        const current = step.state === "current";
        const locked = step.state === "locked";
        const Icon = done ? CheckCircle2 : locked ? Lock : Circle;
        return (
          <div key={`${step.label}-${index}`} className="relative flex min-h-24 flex-col justify-between rounded-2xl border p-3 shadow-sm" style={{ borderColor: current ? "color-mix(in srgb, var(--shell-info) 44%, transparent)" : "var(--shell-border)", backgroundColor: done ? "color-mix(in srgb, var(--shell-success) 10%, var(--shell-panel-strong))" : current ? "color-mix(in srgb, var(--shell-info) 10%, var(--shell-panel-strong))" : "var(--shell-panel-muted)" }}>
            <Icon className="h-4 w-4" style={{ color: done ? "var(--shell-success)" : current ? "var(--brand-navy)" : "var(--text-secondary)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{step.label}</p>
            {current ? (
              <span className="absolute inset-x-4 bottom-1 h-1 rounded-full" style={{ backgroundColor: "var(--shell-info)" }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function UserBadgeTile({
  title,
  subtitle,
  unlocked,
}: {
  title: string;
  subtitle: string;
  unlocked: boolean;
}) {
  return (
    <div className="nxt-shell-hover flex min-h-32 flex-col justify-between rounded-[18px] border p-3 shadow-sm" style={{ borderColor: unlocked ? "color-mix(in srgb, var(--tenant-accent) 40%, transparent)" : "var(--shell-border)", background: unlocked ? "linear-gradient(180deg, color-mix(in srgb, var(--tenant-accent) 15%, var(--shell-panel-strong)), var(--shell-panel-bg))" : "var(--shell-panel-muted)" }}>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: unlocked ? "var(--brand-navy)" : "var(--surface-soft)", color: unlocked ? "#ffffff" : "var(--text-secondary)" }}>
        <Award className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
      </div>
    </div>
  );
}
