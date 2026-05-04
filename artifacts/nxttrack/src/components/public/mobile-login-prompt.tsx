"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";

const SKIP_KEY = "nxt-loginprompt-skipped";

export interface MobileLoginPromptProps {
  slug: string;
  tenantName: string;
}

/**
 * Mobile-first login banner shown for unauthenticated visitors.
 * Skippable; persists dismissal in localStorage so it doesn't nag.
 */
export function MobileLoginPrompt({ slug, tenantName }: MobileLoginPromptProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const skipped = localStorage.getItem(SKIP_KEY);
      if (skipped !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 md:hidden">
      <div
        className="relative mx-auto flex max-w-md flex-col gap-2 rounded-2xl border p-4 shadow-lg"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
          boxShadow: "0 4px 24px var(--shadow-color)",
        }}
        role="dialog"
        aria-label="Inloggen aanmoedigen"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Sluiten"
          className="absolute right-2 top-2 rounded-lg p-1 hover:bg-black/5"
          style={{ color: "var(--text-secondary)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Welkom bij {tenantName}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Log in om je trainingen, meldingen en profiel te zien — of blijf rondkijken.
        </p>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Niet nu
          </button>
          <Link
            href={`/t/${slug}/login`}
            onClick={dismiss}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <LogIn className="h-3.5 w-3.5" /> Inloggen
          </Link>
        </div>
      </div>
    </div>
  );
}
