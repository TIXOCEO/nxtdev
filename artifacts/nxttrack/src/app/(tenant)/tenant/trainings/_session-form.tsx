"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrainingSession } from "@/lib/actions/tenant/trainings";

export interface SessionFormProgram {
  id: string;
  name: string;
  plans: Array<{
    name: string;
    price: number | null;
    billing_period: string | null;
    is_default: boolean;
  }>;
}

export interface TrainingSessionFormProps {
  tenantId: string;
  groups: Array<{ id: string; name: string }>;
  programs?: SessionFormProgram[];
}

function formatPrice(p: number | null, period: string | null) {
  if (p == null) return "Geen prijs";
  const fmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
  return `${fmt.format(p)}${period ? ` / ${period}` : ""}`;
}

export function TrainingSessionForm({ tenantId, groups, programs = [] }: TrainingSessionFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string[]> | null>(null);
  const [programId, setProgramId] = useState<string>("");

  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === programId) ?? null,
    [programs, programId],
  );

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
        program_id: programId || null,
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

      {programs.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Programma (optioneel)
          </label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            disabled={pending}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">— Geen programma —</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Bij keuze worden default-resources van het programma automatisch op de sessie geplaatst.
          </p>
          {selectedProgram && selectedProgram.plans.length > 0 && (
            <div
              className="mt-2 rounded-xl border p-2.5"
              style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
            >
              <p className="mb-1 text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Gekoppelde lidmaatschapsplannen ({selectedProgram.plans.length})
              </p>
              <ul className="grid gap-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {selectedProgram.plans.map((pl, i) => (
                  <li key={`${pl.name}-${i}`}>
                    {pl.is_default ? "★ " : "• "}
                    {pl.name} — {formatPrice(pl.price, pl.billing_period)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedProgram && selectedProgram.plans.length === 0 && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Geen lidmaatschapsplannen gekoppeld aan dit programma.
            </p>
          )}
        </div>
      )}

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
