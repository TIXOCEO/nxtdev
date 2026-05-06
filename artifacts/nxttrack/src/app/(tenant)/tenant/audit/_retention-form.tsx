"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAuditRetention } from "@/lib/actions/tenant/audit-retention";

const PRESETS: Array<{ label: string; value: string }> = [
  { label: "12 maanden", value: "12" },
  { label: "24 maanden", value: "24" },
  { label: "36 maanden", value: "36" },
  { label: "60 maanden", value: "60" },
  { label: "Nooit opschonen", value: "never" },
  { label: "Aangepast…", value: "custom" },
];

function presetForMonths(months: number | null): string {
  if (months === null) return "never";
  const match = PRESETS.find((p) => p.value === String(months));
  return match ? match.value : "custom";
}

export interface RetentionFormProps {
  tenantId: string;
  currentMonths: number | null;
}

export function RetentionForm({ tenantId, currentMonths }: RetentionFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preset, setPreset] = useState<string>(() => presetForMonths(currentMonths));
  const [customMonths, setCustomMonths] = useState<string>(
    currentMonths !== null && presetForMonths(currentMonths) === "custom"
      ? String(currentMonths)
      : "",
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resolveMonths(): { ok: true; months: number | null } | { ok: false; error: string } {
    if (preset === "never") return { ok: true, months: null };
    if (preset === "custom") {
      const trimmed = customMonths.trim();
      if (trimmed === "") {
        return { ok: false, error: "Vul een aantal maanden in." };
      }
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 0) {
        return { ok: false, error: "Bewaartermijn moet een geheel getal ≥ 0 zijn." };
      }
      return { ok: true, months: n };
    }
    const n = Number(preset);
    if (!Number.isFinite(n)) return { ok: false, error: "Ongeldige keuze." };
    return { ok: true, months: n };
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    setSuccess(null);

    const resolved = resolveMonths();
    if (!resolved.ok) {
      setServerError(resolved.error);
      return;
    }

    startTransition(async () => {
      const res = await updateAuditRetention({
        tenant_id: tenantId,
        months: resolved.months,
      });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setSuccess(
        resolved.months === null
          ? "Bewaartermijn bijgewerkt: events worden niet meer automatisch verwijderd."
          : `Bewaartermijn bijgewerkt: ${resolved.months} ${
              resolved.months === 1 ? "maand" : "maanden"
            }.`,
      );
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="retention-preset"
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          Bewaartermijn
        </label>
        <select
          id="retention-preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="h-9 min-w-[12rem] rounded-md border bg-transparent px-2 text-sm"
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {preset === "custom" && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="retention-months"
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Aantal maanden
          </label>
          <input
            id="retention-months"
            type="number"
            min={0}
            step={1}
            value={customMonths}
            onChange={(e) => setCustomMonths(e.target.value)}
            className="h-9 w-32 rounded-md border bg-transparent px-2 text-sm"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md px-4 text-sm font-medium disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
        >
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>

      {(serverError || success) && (
        <div className="basis-full">
          {serverError && (
            <div
              className="rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: "rgb(252 165 165)",
                backgroundColor: "rgb(254 242 242)",
                color: "rgb(153 27 27)",
              }}
            >
              {serverError}
            </div>
          )}
          {success && (
            <div
              className="rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: "rgb(167 243 208)",
                backgroundColor: "rgb(236 253 245)",
                color: "rgb(6 95 70)",
              }}
            >
              {success}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
