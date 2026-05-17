"use client";

import { useState, useTransition } from "react";
import { setPublicShowUpcomingSessions } from "@/lib/actions/tenant/tenant-events";

interface Props {
  tenantId: string;
  initialEnabled: boolean;
}

export function PublicShowSessionsToggle({ tenantId, initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !enabled;
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const res = await setPublicShowUpcomingSessions(tenantId, next);
      if (!res.ok) {
        setError(res.error);
        setEnabled(!next);
      }
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Toon "Aankomende sessies" op de publieke homepage
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          Bezoekers zien dan een tegel met de eerstvolgende trainingen in de
          komende 14 dagen. Géén deelnemerslijst, alleen tijd, groep en locatie.
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        onClick={toggle}
        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50"
        style={{
          backgroundColor: enabled
            ? "var(--accent)"
            : "color-mix(in srgb, var(--text-secondary) 30%, transparent)",
        }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
          style={{ transform: enabled ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}
