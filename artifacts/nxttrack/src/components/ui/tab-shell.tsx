"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabShellTab {
  key: string;
  label: string;
  hidden?: boolean;
  badge?: React.ReactNode;
  content: React.ReactNode;
}

export interface TabShellProps {
  tabs: TabShellTab[];
  /** Default tab when no `?tab=…` query is present. */
  defaultKey?: string;
  /** Querystring parameter name. Defaults to `tab`. */
  paramName?: string;
  /** Optional className for the outer wrapper. */
  className?: string;
}

/**
 * Sprint 39 — Stabiele tab-shell zonder layout-spring.
 *
 * - Houdt alle tabs gemount (display:none op inactieve), zodat formulier-
 *   state behouden blijft en er geen scroll-jump optreedt.
 * - Onthoudt de hoogste content-hoogte tot dusver via ResizeObserver en
 *   gebruikt die als min-height — voorkomt dat de pagina inkort wanneer je
 *   van een lange tab naar een korte tab wisselt en je scroll-positie
 *   plotseling buiten de pagina valt.
 * - URL-sync gebeurt via window.history.replaceState (geen Next router-
 *   round-trip), dus geen re-render-race tijdens initial mount.
 */
export function TabShell({
  tabs,
  defaultKey,
  paramName = "tab",
  className,
}: TabShellProps) {
  const params = useSearchParams();

  const visibleTabs = useMemo(
    () => tabs.filter((t) => !t.hidden),
    [tabs],
  );
  const fallback = useMemo(() => {
    if (defaultKey && visibleTabs.some((t) => t.key === defaultKey)) {
      return defaultKey;
    }
    return visibleTabs[0]?.key ?? "";
  }, [defaultKey, visibleTabs]);

  const initial = (() => {
    const fromUrl = params.get(paramName);
    if (fromUrl && visibleTabs.some((t) => t.key === fromUrl)) return fromUrl;
    return fallback;
  })();

  const [active, setActive] = useState<string>(initial);

  // Als de zichtbare tabs veranderen (bv. rollen wijzigen) en de actieve
  // tab valt weg, klap terug naar de fallback i.p.v. een lege weergave.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === active)) {
      setActive(fallback);
    }
  }, [visibleTabs, active, fallback]);

  // URL-sync zonder router-roundtrip. We muteren window.history direct.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get(paramName);
    if (active === fallback) {
      if (current === null) return;
      url.searchParams.delete(paramName);
    } else {
      if (current === active) return;
      url.searchParams.set(paramName, active);
    }
    const qs = url.searchParams.toString();
    const next = `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
    window.history.replaceState(null, "", next);
  }, [active, fallback, paramName]);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const [minHeight, setMinHeight] = useState(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) setMinHeight((prev) => (h > prev ? h : prev));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        aria-label="Tabbladen"
        className="mb-4 flex flex-wrap gap-1"
      >
        {visibleTabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${t.key}`}
              id={`tab-${t.key}`}
              onClick={() => setActive(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
                isActive && "shadow-sm",
              )}
              style={{
                borderColor: isActive
                  ? "color-mix(in srgb, var(--accent) 60%, var(--surface-border))"
                  : "var(--surface-border)",
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--accent) 14%, var(--surface-soft))"
                  : "var(--surface-soft)",
                color: "var(--text-primary)",
              }}
            >
              {t.label}
              {t.badge ? (
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: "var(--surface-main)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        ref={contentRef}
        style={minHeight > 0 ? { minHeight: `${minHeight}px` } : undefined}
      >
        {visibleTabs.map((t) => {
          const isActive = t.key === active;
          return (
            <div
              key={t.key}
              role="tabpanel"
              id={`tabpanel-${t.key}`}
              aria-labelledby={`tab-${t.key}`}
              hidden={!isActive}
              style={{ display: isActive ? undefined : "none" }}
            >
              {t.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
