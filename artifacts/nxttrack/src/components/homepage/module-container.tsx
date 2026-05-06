import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface ModuleContainerProps {
  title?: string | null;
  action?: { label: string; href: string } | null;
  children: ReactNode;
  /** Internal padding control. */
  padded?: boolean;
  className?: string;
}

/**
 * Sprint 29 — Shared visual shell voor elke homepage-module.
 * De container vult 100% van de hoogte die het grid-item krijgt.
 * Content die niet past krijgt een interne scrollbar; de container
 * zelf beweegt nooit.
 */
export function ModuleContainer({
  title,
  action,
  children,
  padded = true,
  className,
}: ModuleContainerProps) {
  return (
    <section
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-nxt-lg)] border ${className ?? ""}`}
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
      }}
    >
      {(title || action) && (
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          {title ? (
            <h2
              className="min-w-0 truncate text-sm font-semibold sm:text-base"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action && (
            <Link
              href={action.href}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold hover:underline"
              style={{ color: "var(--text-primary)" }}
            >
              {action.label} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </header>
      )}
      <div
        className={
          padded
            ? "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 [scrollbar-width:thin]"
            : "min-h-0 flex-1 overflow-hidden"
        }
      >
        {children}
      </div>
    </section>
  );
}
