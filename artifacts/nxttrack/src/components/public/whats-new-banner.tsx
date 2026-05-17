"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

interface Props {
  slug: string;
  version: string;
  /**
   * Stable identifier of the current user. Used to namespace the dismissal
   * key so that, on a shared device, dismissing the banner as user A does
   * not hide it from user B.
   */
  userId: string;
}

/**
 * Sprint 78 — "Wat is nieuw"-banner. Eenmalig zichtbaar per gebruiker per
 * versie (dismissal in localStorage). Geen server-state nodig: bewust
 * gekozen om geen DB-table aan te raken in deze sprint.
 */
export function WhatsNewBanner({ slug, version, userId }: Props) {
  const storageKey = `nxt-whatsnew-dismissed:${userId}:${version}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const seen = window.localStorage.getItem(storageKey);
      if (!seen) setVisible(true);
    } catch {
      // localStorage geblokkeerd (private mode): banner toont niet, geen blocker.
    }
  }, [storageKey]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // negeer
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Nieuwe versie beschikbaar"
      className="flex items-start gap-3 rounded-[var(--radius-nxt-lg)] border p-3 sm:p-4"
      style={{
        borderColor: "color-mix(in srgb, var(--brand-navy) 25%, var(--surface-border))",
        backgroundColor: "var(--accent-tint)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: "var(--surface-main)",
          color: "var(--brand-navy)",
        }}
      >
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Vernieuwde uitstraling</p>
        <p className="mt-0.5" style={{ color: "var(--text-secondary)" }}>
          We hebben de navigatie en het ontwerp opgefrist.{" "}
          <Link
            href={`/t/${slug}/p/releases`}
            className="font-medium underline"
            style={{ color: "var(--brand-navy)" }}
          >
            Bekijk wat er nieuw is
          </Link>
          .
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Sluiten"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
        style={{ color: "var(--text-secondary)" }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
