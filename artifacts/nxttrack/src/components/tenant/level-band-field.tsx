"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { updateGroupLevelBand } from "@/lib/actions/tenant/members";

/**
 * Sprint 71 — Inline editor voor `groups.level_band`.
 *
 * Vrij-tekst label (bv. "Watervrij", "A", "U10") dat door
 * `score_placement_candidates` case-insensitive exact wordt vergeleken
 * met `preferences_json.preferred_level` uit een intake-submission.
 */
export function LevelBandField({
  tenantId,
  groupId,
  initialValue,
  label,
  helpText,
}: {
  tenantId: string;
  groupId: string;
  initialValue: string | null;
  label: string;
  helpText?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>(initialValue ?? "");

  function onSave() {
    setErr(null);
    const trimmed = draft.trim();
    if (trimmed.length > 64) {
      setErr("Maximaal 64 tekens.");
      return;
    }
    startTransition(async () => {
      const res = await updateGroupLevelBand({
        tenant_id: tenantId,
        group_id: groupId,
        level_band: trimmed === "" ? null : trimmed,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const inputCls =
    "h-8 w-40 rounded-lg border bg-transparent px-2 text-xs outline-none";
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
            type="text"
            maxLength={64}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
            placeholder="bv. Watervrij of A"
            className={inputCls}
            style={inputStyle}
            aria-label={label}
          />
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Check className="h-3 w-3" /> Opslaan
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(initialValue ?? "");
              setErr(null);
            }}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          >
            <X className="h-3 w-3" /> Annuleren
          </button>
          {err && <span className="text-red-600">{err}</span>}
        </>
      ) : (
        <>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {initialValue && initialValue.trim() !== "" ? initialValue : "—"}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          >
            <Pencil className="h-3 w-3" /> Wijzigen
          </button>
          {helpText && (
            <span style={{ color: "var(--text-secondary)" }}>· {helpText}</span>
          )}
        </>
      )}
    </div>
  );
}
