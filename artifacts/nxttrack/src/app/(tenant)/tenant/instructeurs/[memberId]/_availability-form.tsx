"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAvailability } from "@/lib/actions/tenant/instructors";

const DAYS = [
  { v: 0, l: "Maandag" },
  { v: 1, l: "Dinsdag" },
  { v: 2, l: "Woensdag" },
  { v: 3, l: "Donderdag" },
  { v: 4, l: "Vrijdag" },
  { v: 5, l: "Zaterdag" },
  { v: 6, l: "Zondag" },
];

export function AvailabilityForm({ tenantId, memberId }: { tenantId: string; memberId: string }) {
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
    startTransition(async () => {
      const res = await createAvailability({
        tenant_id: tenantId,
        member_id: memberId,
        day_of_week: Number(fd.get("day_of_week")),
        start_time: String(fd.get("start_time")),
        end_time: String(fd.get("end_time")),
        availability_type: (fd.get("availability_type") as "available" | "preferred" | "unavailable") ?? "available",
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
        <select name="day_of_week" required disabled={pending} className={inputCls} style={inputStyle}>
          {DAYS.map((d) => (
            <option key={d.v} value={d.v}>{d.l}</option>
          ))}
        </select>
        <select name="availability_type" required disabled={pending} className={inputCls} style={inputStyle} defaultValue="available">
          <option value="available">Beschikbaar</option>
          <option value="preferred">Voorkeur</option>
          <option value="unavailable">Niet beschikbaar</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="time" name="start_time" required disabled={pending} className={inputCls} style={inputStyle} />
        <input type="time" name="end_time" required disabled={pending} className={inputCls} style={inputStyle} />
      </div>
      <input type="text" name="notes" placeholder="Notitie (optioneel)" disabled={pending} className={inputCls} style={inputStyle} />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        {pending ? "Opslaan…" : "Toevoegen"}
      </button>
    </form>
  );
}
