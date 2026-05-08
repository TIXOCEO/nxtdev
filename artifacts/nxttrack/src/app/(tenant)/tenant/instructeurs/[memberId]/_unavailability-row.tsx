"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { updateUnavailability, deleteUnavailability } from "@/lib/actions/tenant/instructors";

export interface UnavailabilityRowData {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  notes: string | null;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function splitIso(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  // local YYYY-MM-DD + HH:MM
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function UnavailabilityRow({
  tenantId,
  row,
}: {
  tenantId: string;
  row: UnavailabilityRowData;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const inputCls = "h-8 rounded-lg border bg-transparent px-2 text-xs outline-none";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  const sStart = splitIso(row.starts_at);
  const sEnd = splitIso(row.ends_at);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const startDate = String(fd.get("start_date") ?? "");
    const startTime = String(fd.get("start_time") ?? "00:00");
    const endDate = String(fd.get("end_date") ?? "");
    const endTime = String(fd.get("end_time") ?? "23:59");
    if (!startDate || !endDate) { setErr("Datums verplicht"); return; }
    const startsAt = new Date(`${startDate}T${startTime}`).toISOString();
    const endsAt = new Date(`${endDate}T${endTime}`).toISOString();
    startTransition(async () => {
      const res = await updateUnavailability({
        tenant_id: tenantId,
        id: row.id,
        starts_at: startsAt,
        ends_at: endsAt,
        reason: (fd.get("reason") as string) || null,
        notes: (fd.get("notes") as string) || null,
      });
      if (!res.ok) { setErr(res.error); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm("Verwijderen?")) return;
    setErr(null);
    startTransition(async () => {
      const res = await deleteUnavailability(tenantId, row.id);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="rounded-lg border p-2 text-xs" style={{ borderColor: "var(--surface-border)" }}>
        <form onSubmit={onSave} className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="start_date" defaultValue={sStart.date} className={inputCls} style={inputStyle} disabled={pending} required />
            <input type="time" name="start_time" defaultValue={sStart.time} className={inputCls} style={inputStyle} disabled={pending} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="end_date" defaultValue={sEnd.date} className={inputCls} style={inputStyle} disabled={pending} required />
            <input type="time" name="end_time" defaultValue={sEnd.time} className={inputCls} style={inputStyle} disabled={pending} />
          </div>
          <select name="reason" defaultValue={row.reason ?? ""} className={inputCls} style={inputStyle} disabled={pending}>
            <option value="">— Reden (optioneel) —</option>
            <option value="vakantie">Vakantie</option>
            <option value="ziekte">Ziekte</option>
            <option value="training">Training/cursus</option>
            <option value="anders">Anders</option>
          </select>
          <input type="text" name="notes" defaultValue={row.notes ?? ""} placeholder="Notitie (optioneel)" className={inputCls} style={inputStyle} disabled={pending} />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}>
              <Check className="h-3 w-3" /> Opslaan
            </button>
            <button type="button" onClick={() => { setEditing(false); setErr(null); }} disabled={pending} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium" style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
              <X className="h-3 w-3" /> Annuleren
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--surface-border)" }}>
      <span style={{ color: "var(--text-primary)" }}>
        {fmtDateTime(row.starts_at)} → {fmtDateTime(row.ends_at)}
        {row.reason ? <span style={{ color: "var(--text-secondary)" }}> · {row.reason}</span> : null}
      </span>
      <span className="flex items-center gap-1">
        <button type="button" onClick={() => setEditing(true)} disabled={pending} className="rounded-md p-1 hover:bg-black/5 disabled:opacity-50" title="Bewerken" aria-label="Bewerken">
          <Pencil className="h-3.5 w-3.5" style={{ color: "var(--text-secondary)" }} />
        </button>
        <button type="button" onClick={onDelete} disabled={pending} className="rounded-md p-1 hover:bg-red-50 disabled:opacity-50" title="Verwijderen" aria-label="Verwijderen">
          <Trash2 className="h-3.5 w-3.5 text-red-600" />
        </button>
      </span>
    </li>
  );
}
