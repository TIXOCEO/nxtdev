"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { sendTrainingReminder } from "@/lib/actions/tenant/trainings";

export interface ReminderButtonProps {
  tenantId: string;
  sessionId: string;
}

export function ReminderButton({ tenantId, sessionId }: ReminderButtonProps) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function send() {
    setMsg(null);
    startTransition(async () => {
      const res = await sendTrainingReminder({
        tenant_id: tenantId,
        session_id: sessionId,
      });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg(`Herinnering verstuurd naar ${res.data.recipientCount} ontvanger(s).`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
      >
        <Bell className="h-3.5 w-3.5" />
        {pending ? "Bezig…" : "Stuur herinnering"}
      </button>
      {msg && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{msg}</span>}
    </div>
  );
}
