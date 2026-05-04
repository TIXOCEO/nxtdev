"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setNotificationPreference } from "@/lib/actions/public/notification-prefs";

interface Props {
  tenantId: string;
  slug: string;
  eventKey: string;
  channel: "email" | "push";
  initial: boolean;
}

export function PrefToggle({ tenantId, slug, eventKey, channel, initial }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onToggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const res = await setNotificationPreference({
        tenant_id: tenantId,
        event_key: eventKey,
        channel,
        enabled: next,
        slug,
      });
      if (!res.ok) {
        setEnabled(!next);
        setError(res.error);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${channel === "email" ? "E-mail" : "Push"}-meldingen voor ${eventKey}`}
        onClick={onToggle}
        disabled={pending}
        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:opacity-60"
        style={{
          backgroundColor: enabled ? "var(--tenant-accent)" : "var(--surface-soft)",
          borderColor: "var(--surface-border)",
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
          style={{ transform: enabled ? "translateX(18px)" : "translateX(2px)" }}
        />
      </button>
      {pending && (
        <Loader2
          className="h-3 w-3 animate-spin"
          style={{ color: "var(--text-secondary)" }}
        />
      )}
      {error && (
        <span title={error} className="text-[10px]" style={{ color: "#b91c1c" }}>
          ⚠
        </span>
      )}
    </span>
  );
}
