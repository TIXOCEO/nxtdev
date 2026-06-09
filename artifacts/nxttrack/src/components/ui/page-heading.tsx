import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeadingProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeading({ title, description, actions, className }: PageHeadingProps) {
  return (
    <div
      className={cn(
        "nxt-shell-surface relative overflow-hidden rounded-[24px] px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: "var(--tenant-accent, var(--accent))" }}
      />
      <div
        aria-hidden
        className="absolute -right-16 -top-20 h-40 w-40 rounded-full blur-3xl"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--tenant-accent, var(--accent)) 18%, transparent)",
        }}
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
