import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_COLOR: Record<Tone, string> = {
  success: "var(--shell-success)",
  warning: "var(--shell-warning)",
  danger: "var(--shell-danger)",
  info: "var(--shell-info)",
  neutral: "var(--text-secondary)",
};

export function TenantAdminSurface({
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
        "nxt-shell-enter nxt-shell-surface rounded-[20px]",
        interactive && "nxt-shell-hover",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function TenantAdminHero({
  title,
  description,
  eyebrow = "Backoffice",
  action,
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <TenantAdminSurface className="overflow-hidden p-0">
      <div className="relative p-5 sm:p-6 lg:p-7">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--tenant-accent, var(--accent)) 28%, transparent)" }}
        />
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="max-w-3xl">
            <p
              className="text-xs font-bold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {eyebrow}
            </p>
            <h1
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h1>
            <p
              className="mt-2 max-w-2xl text-sm leading-6 sm:text-base"
              style={{ color: "var(--text-secondary)" }}
            >
              {description}
            </p>
          </div>
          {action}
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </TenantAdminSurface>
  );
}

export function TenantAdminMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <TenantAdminSurface className="p-4" interactive>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--text-secondary)" }}
          >
            {label}
          </p>
          <p
            className="mt-2 text-3xl font-bold tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </p>
        </div>
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
          style={{
            borderColor: "var(--shell-border)",
            backgroundColor: "color-mix(in srgb, var(--tenant-accent, var(--accent)) 12%, var(--shell-panel-strong))",
            color: TONE_COLOR[tone],
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {hint ? (
        <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      ) : null}
    </TenantAdminSurface>
  );
}

export function TenantAdminSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function TenantAdminActionLink({
  href,
  children,
  icon: Icon = ArrowRight,
}: {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="nxt-focus-ring nxt-shell-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
    >
      {children}
      <Icon className="h-4 w-4" />
    </Link>
  );
}

export function TenantAdminListItem({
  href,
  title,
  meta,
  icon: Icon = CircleDashed,
  children,
}: {
  href?: string;
  title: string;
  meta?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  const content = (
    <div className="flex items-start gap-3 p-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: "var(--shell-panel-muted)",
          color: "var(--shell-info)",
        }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
            {meta}
          </p>
        ) : null}
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
      {href ? (
        <ArrowRight className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
      ) : null}
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="nxt-focus-ring block rounded-2xl transition-colors hover:bg-black/5">
      {content}
    </Link>
  );
}

export function TenantAdminBars({
  data,
}: {
  data: Array<{ label: string; registrations: number; members: number }>;
}) {
  const max = Math.max(1, ...data.flatMap((p) => [p.registrations, p.members]));
  return (
    <div className="flex h-64 items-end gap-3 px-1 pt-4">
      {data.map((point) => (
        <div key={point.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
          <div className="flex flex-1 items-end justify-center gap-1.5">
            <div
              className="w-full max-w-5 rounded-t-md"
              style={{
                height: `${Math.max(5, (point.registrations / max) * 100)}%`,
                background: "linear-gradient(180deg, var(--shell-info), color-mix(in srgb, var(--shell-info) 50%, transparent))",
              }}
              title={`${point.registrations} aanmeldingen`}
            />
            <div
              className="w-full max-w-5 rounded-t-md"
              style={{
                height: `${Math.max(5, (point.members / max) * 100)}%`,
                background: "linear-gradient(180deg, var(--tenant-accent, var(--accent)), color-mix(in srgb, var(--tenant-accent, var(--accent)) 42%, transparent))",
              }}
              title={`${point.members} leden`}
            />
          </div>
          <p className="truncate text-center text-xs" style={{ color: "var(--text-secondary)" }}>
            {point.label}
          </p>
        </div>
      ))}
    </div>
  );
}

export function TenantAdminSegmentChart({
  data,
}: {
  data: Array<{ label: string; value: number; tone: Tone }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--shell-panel-muted)" }}>
        {data.map((item) => (
          <div
            key={item.label}
            style={{
              width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
              backgroundColor: TONE_COLOR[item.tone],
            }}
          />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-md px-3 py-2" style={{ backgroundColor: "var(--shell-panel-muted)" }}>
            <span className="flex min-w-0 items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TONE_COLOR[item.tone] }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
