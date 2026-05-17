import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string | null;
  actions?: ReactNode;
}

/**
 * Sprint 78 — Page-title-bar met navy verticale accent-balk (brand-constant).
 * Plaatsen aan de top van elke routes-`<main>`-inhoud onder de globale header.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1 inline-block h-7 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: "var(--brand-navy)" }}
        />
        <div className="min-w-0">
          <h1
            className="truncate text-lg font-semibold sm:text-xl"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="mt-0.5 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
