"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUnavailability } from "@/lib/actions/tenant/instructors";

export function UnavailabilityForm({ tenantId, memberId }: { tenantId: string; memberId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const inputCls = "h-9 w-full rounded-lg border bg-transparent px-2 text-xs outline-none";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const startDate = String(fd.get("start_date") ?? "");
    const startTime = String(fd.get("start_time") ?? "00:00");
    const endDate = String(fd.get("end_date") ?? "");
    const endTime = String(fd.get("end_time") ?? "23:59");
    if (!startDate || !endDate) {
      setErr("Datums verplicht");
      return;
    }
    const startsAt = new Date(`${startDate}T${startTime}`).toISOString();
    const endsAt = new Date(`${endDate}T${endTime}`).toISOString();
    startTransition(async () => {
      const res = await createUnavailability({
        tenant_id: tenantId,
        member_id: memberId,
        starts_at: startsAt,
        ends_at: endsAt,
        reason: (fd.get("reason") as string) || null,
        notes: (fd.get("notes") as string) || null,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2 border-t pt-3" style={{ borderColor: "var(--surface-border)" }}>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" name="start_date" required disabled={pending} className={inputCls} style={inputStyle} />
        <input type="time" name="start_time" defaultValue="00:00" disabled={pending} className={inputCls} style={inputStyle} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" name="end_date" required disabled={pending} className={inputCls} style={inputStyle} />
        <input type="time" name="end_time" defaultValue="23:59" disabled={pending} className={inputCls} style={inputStyle} />
      </div>
      <select name="reason" disabled={pending} className={inputCls} style={inputStyle}>
        <option value="">— Reden (optioneel) —</option>
        <option value="vakantie">Vakantie</option>
        <option value="ziekte">Ziekte</option>
        <option value="training">Training/cursus</option>
        <option value="anders">Anders</option>
      </select>
      <input type="text" name="notes" placeholder="Notitie (optioneel)" disabled={pending} className={inputCls} style={inputStyle} />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        {pending ? "Opslaan…" : "Afwezigheid toevoegen"}
      </button>
    </form>
  );
}
