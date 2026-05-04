"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTrainingSettings } from "@/lib/actions/tenant/training-settings";

export interface TrainingSettingsFormProps {
  tenantId: string;
  initial: {
    reminder_hours_before: number;
    late_response_hours: number;
    notify_trainer_on_late: boolean;
  };
}

export function TrainingSettingsForm({ tenantId, initial }: TrainingSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reminder, setReminder] = useState(initial.reminder_hours_before);
  const [late, setLate] = useState(initial.late_response_hours);
  const [notify, setNotify] = useState(initial.notify_trainer_on_late);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await saveTrainingSettings({
        tenant_id: tenantId,
        reminder_hours_before: reminder,
        late_response_hours: late,
        notify_trainer_on_late: notify,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Opgeslagen.");
      router.refresh();
    });
  }

  const inputCls =
    "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Herinnering (uren voor start)
        </label>
        <input
          type="number"
          min={1}
          max={168}
          value={reminder}
          onChange={(e) => setReminder(Number(e.target.value))}
          disabled={pending}
          className={inputCls}
          style={inputStyle}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Late wijziging (uren voor start)
        </label>
        <input
          type="number"
          min={0}
          max={168}
          value={late}
          onChange={(e) => setLate(Number(e.target.value))}
          disabled={pending}
          className={inputCls}
          style={inputStyle}
        />
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Reacties binnen deze periode worden gemarkeerd als laat.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          disabled={pending}
        />
        Trainer een melding sturen bij late wijziging
      </label>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{msg}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        {pending ? "Bezig…" : "Opslaan"}
      </button>
    </form>
  );
}
