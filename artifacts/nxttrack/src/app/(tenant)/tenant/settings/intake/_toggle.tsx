"use client";

import { useState, useTransition } from "react";
import { setPublicProposeSlots } from "./_actions";

export function IntakeSettingsToggle({
  tenantId,
  initialEnabled,
}: {
  tenantId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flip(next: boolean) {
    setError(null);
    const prev = enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await setPublicProposeSlots({ tenantId, enabled: next });
      if (!res.ok) {
        setEnabled(prev);
        setError(res.error ?? "Kon instelling niet opslaan.");
      }
    });
  }

  return (
    <div>
      <label className="flex items-center justify-between gap-3">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Toon publieke tijdsblok-voorstellen na indienen
        </span>
        <button
          type="button"
          onClick={() => flip(!enabled)}
          disabled={pending}
          aria-pressed={enabled}
          className="relative h-6 w-11 rounded-full transition"
          style={{
            backgroundColor: enabled ? "var(--tenant-accent)" : "var(--border)",
            opacity: pending ? 0.6 : 1,
          }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition"
            style={{ left: enabled ? "1.25rem" : "0.125rem" }}
          />
        </button>
      </label>
      {error ? (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
