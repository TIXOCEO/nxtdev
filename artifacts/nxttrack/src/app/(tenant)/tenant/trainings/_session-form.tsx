"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrainingSession } from "@/lib/actions/tenant/trainings";

export interface TrainingSessionFormProps {
  tenantId: string;
  groups: Array<{ id: string; name: string }>;
}

export function TrainingSessionForm({ tenantId, groups }: TrainingSessionFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string[]> | null>(null);

  const inputCls =
    "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setFieldErrs(null);
    const fd = new FormData(e.currentTarget);

    const startDate = String(fd.get("start_date") ?? "");
    const startTime = String(fd.get("start_time") ?? "");
    const endDate = String(fd.get("end_date") ?? "");
    const endTime = String(fd.get("end_time") ?? "");

    const startsAt = startDate && startTime ? new Date(`${startDate}T${startTime}`).toISOString() : "";
    const endsAt = endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : "";

    startTransition(async () => {
      const res = await createTrainingSession({
        tenant_id: tenantId,
        group_id: String(fd.get("group_id") ?? ""),
        title: String(fd.get("title") ?? ""),
        description: String(fd.get("description") ?? ""),
        location: String(fd.get("location") ?? ""),
        starts_at: startsAt,
        ends_at: endsAt,
      });
      if (!res.ok) {
        setErr(res.error);
        if (res.fieldErrors) setFieldErrs(res.fieldErrors);
        return;
      }
      router.push(`/tenant/trainings/${res.data.id}`);
      router.refresh();
    });
  }

  function fe(k: string) {
    return fieldErrs?.[k]?.[0];
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Groep
        </label>
        <select name="group_id" required disabled={pending} className={inputCls} style={inputStyle}>
          <option value="">— Kies groep —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        {fe("group_id") && <p className="text-xs text-red-600">{fe("group_id")}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Titel
        </label>
        <input name="title" required disabled={pending} className={inputCls} style={inputStyle} />
        {fe("title") && <p className="text-xs text-red-600">{fe("title")}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Start
          </label>
          <div className="flex gap-2">
            <input type="date" name="start_date" required disabled={pending} className={inputCls} style={inputStyle} />
            <input type="time" name="start_time" required disabled={pending} className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Einde
          </label>
          <div className="flex gap-2">
            <input type="date" name="end_date" required disabled={pending} className={inputCls} style={inputStyle} />
            <input type="time" name="end_time" required disabled={pending} className={inputCls} style={inputStyle} />
          </div>
          {fe("ends_at") && <p className="text-xs text-red-600">{fe("ends_at")}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Locatie
        </label>
        <input name="location" disabled={pending} className={inputCls} style={inputStyle} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Beschrijving
        </label>
        <textarea name="description" rows={3} disabled={pending} className={`${inputCls} h-auto py-2`} style={inputStyle} />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        {pending ? "Bezig…" : "Training aanmaken"}
      </button>
    </form>
  );
}
