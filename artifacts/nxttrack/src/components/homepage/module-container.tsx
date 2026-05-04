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
 * Shared visual shell for every homepage module.
 * Rounded, subtle border, title top-left, optional link top-right.
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
      className={`flex h-full flex-col rounded-[var(--radius-nxt-lg)] border ${className ?? ""}`}
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
      }}
    >
      {(title || action) && (
        <header
          className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5"
        >
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
      <div className={padded ? "flex-1 px-4 py-4 sm:px-5 sm:py-5" : "flex-1"}>
        {children}
      </div>
    </section>
  );
}
