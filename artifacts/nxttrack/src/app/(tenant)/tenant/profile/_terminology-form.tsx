"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";
import {
  TERMINOLOGY_KEYS,
  TERMINOLOGY_KEY_LABELS,
} from "@/lib/terminology/labels";
import { resolveTerminology } from "@/lib/terminology/merge";
import { updateTenantTerminologyOverrides } from "@/lib/actions/tenant/terminology";
import type { TerminologyKey } from "@/lib/terminology/types";

export interface TerminologyFormProps {
  tenantId: string;
  initialOverrides: Record<string, string>;
  /** Effectief baseline (generic ← sector), gebruikt als placeholder. */
  inheritedTerminology: Record<string, string>;
}

export function TerminologyForm({
  tenantId,
  initialOverrides,
  inheritedTerminology,
}: TerminologyFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, string>>({ ...initialOverrides });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const effective = useMemo(
    () =>
      resolveTerminology({
        generic: inheritedTerminology,
        overrides,
      }),
    [inheritedTerminology, overrides],
  );

  const dirtyCount = Object.values(overrides).filter((v) => typeof v === "string" && v.trim().length > 0).length;

  function onSave() {
    setErr(null);
    setMsg(null);
    const cleaned: Record<string, string> = {};
    for (const k of TERMINOLOGY_KEYS) {
      const v = overrides[k];
      if (typeof v === "string" && v.trim().length > 0) cleaned[k] = v.trim();
    }
    start(async () => {
      const res = await updateTenantTerminologyOverrides({
        tenant_id: tenantId,
        terminology_overrides: cleaned,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg(
        res.data.override_count === 0
          ? "Overrides gewist — sector-template geldt weer overal."
          : `Opgeslagen — ${res.data.override_count} eigen woord${res.data.override_count === 1 ? "" : "en"}.`,
      );
      setOverrides(cleaned);
      router.refresh();
    });
  }

  function onResetOverrides() {
    setOverrides({});
  }

  return (
    <div
      className="space-y-5 rounded-2xl border p-4 sm:p-6"
      style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            Eigen woordenschat
          </p>
          <p className="mt-1 max-w-prose text-xs" style={{ color: "var(--text-secondary)" }}>
            Pas hier de labels aan die jouw vereniging gebruikt. Lege velden vallen
            automatisch terug op de sector-template (zie placeholder en pijltje).
            De sectorkeuze zelf wordt door een platform-admin beheerd.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetOverrides}
          disabled={pending || dirtyCount === 0}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
        >
          <RotateCcw className="h-3 w-3" /> Wis alle overrides
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {TERMINOLOGY_KEYS.map((k: TerminologyKey) => (
          <Field key={k} label={TERMINOLOGY_KEY_LABELS[k]}>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <input
                value={overrides[k] ?? ""}
                placeholder={inheritedTerminology[k] ?? ""}
                onChange={(e) => setOverrides({ ...overrides, [k]: e.target.value })}
                className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              />
              <span
                className="truncate text-[11px]"
                style={{ color: "var(--text-secondary)" }}
                title={effective[k]}
              >
                → {effective[k]}
              </span>
            </div>
          </Field>
        ))}
      </div>

      {(msg || err) && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={
            err
              ? { borderColor: "rgb(252 165 165)", backgroundColor: "rgb(254 242 242)", color: "rgb(153 27 27)" }
              : { borderColor: "rgb(167 243 208)", backgroundColor: "rgb(236 253 245)", color: "rgb(6 95 70)" }
          }
        >
          {err ?? msg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Save className="h-3.5 w-3.5" /> {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        className="mb-1 block text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
