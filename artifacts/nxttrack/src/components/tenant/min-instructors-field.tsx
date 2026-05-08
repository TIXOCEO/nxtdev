"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import {
  updateGroupMinInstructors,
  updateSessionMinInstructors,
} from "@/lib/actions/tenant/instructors";

type Scope = { kind: "group"; groupId: string } | { kind: "session"; sessionId: string };

export function MinInstructorsField({
  tenantId,
  scope,
  initialValue,
  label,
  helpText,
}: {
  tenantId: string;
  scope: Scope;
  initialValue: number | null;
  label: string;
  helpText?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>(initialValue == null ? "" : String(initialValue));

  function onSave() {
    setErr(null);
    const trimmed = draft.trim();
    let value: number | null;
    if (trimmed === "") value = null;
    else {
      const n = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(n) || n < 0 || n > 50) {
        setErr("Voer een getal tussen 0 en 50 in (of leeg).");
        return;
      }
      value = n;
    }
    startTransition(async () => {
      const res = scope.kind === "group"
        ? await updateGroupMinInstructors({ tenant_id: tenantId, group_id: scope.groupId, default_min_instructors: value })
        : await updateSessionMinInstructors({ tenant_id: tenantId, session_id: scope.sessionId, min_instructors: value });
      if (!res.ok) { setErr(res.error); return; }
      setEditing(false);
      router.refresh();
    });
  }

  const inputCls = "h-8 w-20 rounded-lg border bg-transparent px-2 text-xs outline-none";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span style={{ color: "var(--text-secondary)" }}>{label}:</span>
      {editing ? (
        <>
          <input
            type="number"
            min={0}
            max={50}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
            placeholder="—"
            className={inputCls}
            style={inputStyle}
            aria-label={label}
          />
          <button type="button" onClick={onSave} disabled={pending} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}>
            <Check className="h-3 w-3" /> Opslaan
          </button>
          <button type="button" onClick={() => { setEditing(false); setDraft(initialValue == null ? "" : String(initialValue)); setErr(null); }} disabled={pending} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium" style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
            <X className="h-3 w-3" /> Annuleren
          </button>
          {err && <span className="text-red-600">{err}</span>}
        </>
      ) : (
        <>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {initialValue == null ? "—" : initialValue}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
            <Pencil className="h-3 w-3" /> Wijzigen
          </button>
          {helpText && <span style={{ color: "var(--text-secondary)" }}>· {helpText}</span>}
        </>
      )}
    </div>
  );
}
