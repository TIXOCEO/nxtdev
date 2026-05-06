"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { requestAdminHandoff } from "@/lib/actions/admin-handoff";

export interface AdminHandoffButtonProps {
  tenantId: string;
  /** Pad op het apex-domein waar de admin uiteindelijk terechtkomt. */
  next?: string;
  /** Visuele variant. */
  variant?: "header" | "menu";
  /** Custom kindering voor menu-variant (icoon + tekst). */
  children?: React.ReactNode;
}

/**
 * Knop die een cross-domain SSO-handoff start naar de admin-shell
 * (`nxttrack.nl/tenant`). Werkt ook vanaf custom domeinen omdat we via
 * Supabase's magic-link verify-flow op het apex-domein landen.
 */
export function AdminHandoffButton({
  tenantId,
  next,
  variant = "header",
  children,
}: AdminHandoffButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const result = await requestAdminHandoff(tenantId, next);
      if (!result.ok || !result.url) {
        setError(result.error ?? "Kon admin-shell niet openen.");
        return;
      }
      // Hard navigatie naar Supabase verify-URL; die redirect daarna
      // naar onze /auth/callback op het apex-domein.
      window.location.assign(result.url);
    });
  }

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-black/5 disabled:opacity-60"
      >
        {children ?? (
          <>
            <LayoutDashboard className="h-4 w-4" />
            <span>{pending ? "Bezig…" : "Admin dashboard"}</span>
          </>
        )}
        {error && (
          <span className="ml-auto text-[10px] font-medium" style={{ color: "#b91c1c" }}>
            !
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-60"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--text-primary)",
        }}
        title="Beheer deze tenant"
      >
        {pending ? "Bezig…" : "Admin"}
      </button>
      {error && (
        <span className="ml-2 text-[10px]" style={{ color: "#b91c1c" }} title={error}>
          Handoff mislukt — <Link href="/login" className="underline">opnieuw inloggen</Link>
        </span>
      )}
    </>
  );
}
