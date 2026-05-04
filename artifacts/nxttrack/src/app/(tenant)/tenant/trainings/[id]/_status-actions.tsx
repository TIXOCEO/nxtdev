"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTrainingStatus } from "@/lib/actions/tenant/trainings";

export interface TrainingStatusActionsProps {
  tenantId: string;
  sessionId: string;
  status: string;
}

export function TrainingStatusActions({
  tenantId,
  sessionId,
  status,
}: TrainingStatusActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function update(next: "scheduled" | "cancelled" | "completed") {
    if (!confirm(`Status wijzigen naar "${next}"?`)) return;
    setErr(null);
    startTransition(async () => {
      const res = await updateTrainingStatus({
        tenant_id: tenantId,
        session_id: sessionId,
        status: next,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  const btnCls =
    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "cancelled" && (
        <button
          type="button"
          onClick={() => update("cancelled")}
          disabled={pending}
          className={btnCls}
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        >
          Annuleren
        </button>
      )}
      {status !== "completed" && (
        <button
          type="button"
          onClick={() => update("completed")}
          disabled={pending}
          className={btnCls}
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        >
          Markeer afgerond
        </button>
      )}
      {status !== "scheduled" && (
        <button
          type="button"
          onClick={() => update("scheduled")}
          disabled={pending}
          className={btnCls}
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        >
          Heractiveer
        </button>
      )}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
