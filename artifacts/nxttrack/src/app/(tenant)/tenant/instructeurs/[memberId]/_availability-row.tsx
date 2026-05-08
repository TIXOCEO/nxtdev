"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { updateAvailability, deleteAvailability } from "@/lib/actions/tenant/instructors";

const DAYS = [
  { v: 0, l: "Maandag" },
  { v: 1, l: "Dinsdag" },
  { v: 2, l: "Woensdag" },
  { v: 3, l: "Donderdag" },
  { v: 4, l: "Vrijdag" },
  { v: 5, l: "Zaterdag" },
  { v: 6, l: "Zondag" },
];
const DAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export interface AvailabilityRowData {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  availability_type: "available" | "preferred" | "unavailable";
  notes: string | null;
}

export function AvailabilityRow({
  tenantId,
  row,
}: {
  tenantId: string;
  row: AvailabilityRowData;
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

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateAvailability({
        tenant_id: tenantId,
        id: row.id,
        day_of_week: Number(fd.get("day_of_week")),
        start_time: String(fd.get("start_time")),
        end_time: String(fd.get("end_time")),
        availability_type: (fd.get("availability_type") as "available" | "preferred" | "unavailable") ?? "available",
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
      const res = await deleteAvailability(tenantId, row.id);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li
        className="rounded-lg border p-2 text-xs"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <form onSubmit={onSave} className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <select name="day_of_week" defaultValue={row.day_of_week} className={inputCls} style={inputStyle} disabled={pending}>
              {DAYS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
            </select>
            <select name="availability_type" defaultValue={row.availability_type} className={inputCls} style={inputStyle} disabled={pending}>
              <option value="available">Beschikbaar</option>
              <option value="preferred">Voorkeur</option>
              <option value="unavailable">Niet beschikbaar</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" name="start_time" defaultValue={row.start_time.slice(0,5)} className={inputCls} style={inputStyle} disabled={pending} required />
            <input type="time" name="end_time" defaultValue={row.end_time.slice(0,5)} className={inputCls} style={inputStyle} disabled={pending} required />
          </div>
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
    <li
      className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs"
      style={{ borderColor: "var(--surface-border)" }}
    >
      <span style={{ color: "var(--text-primary)" }}>
        <strong>{DAY_LABELS[row.day_of_week]}</strong>{" "}
        {row.start_time.slice(0,5)}–{row.end_time.slice(0,5)}{" "}
        <span style={{ color: "var(--text-secondary)" }}>· {row.availability_type}</span>
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
