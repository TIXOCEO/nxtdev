"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "nxt-install-dismissed";

export interface InstallAppPromptProps {
  tenantName: string;
}

/**
 * Sprint 13 — captures the browser's `beforeinstallprompt` event and
 * surfaces a tenant-branded install banner. Hidden if the app is already
 * installed (display-mode standalone) or the user dismissed it.
 */
export function InstallAppPrompt({ tenantName }: InstallAppPromptProps) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || !evt) return null;

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    setEvt(null);
    if (choice.outcome === "dismissed") {
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-3"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <Download className="h-4 w-4" style={{ color: "var(--tenant-accent)" }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Installeer {tenantName}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Voeg toe aan je beginscherm voor snel toegang.
        </p>
      </div>
      <button
        type="button"
        onClick={install}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold"
        style={{ backgroundColor: "var(--tenant-accent)", color: "var(--text-primary)" }}
      >
        Installeer
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-lg border px-2 py-1.5"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
        aria-label="Sluiten"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
