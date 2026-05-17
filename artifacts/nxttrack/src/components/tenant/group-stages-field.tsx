"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  attachGroupStage,
  detachGroupStage,
} from "@/lib/actions/tenant/program-stages";

/**
 * Sprint 72 — Multi-select editor voor `group_stages`.
 *
 * Vervangt de Sprint-71 `LevelBandField` (vrij-tekst). Toont gekoppelde
 * stages als verwijderbare chips en biedt een dropdown om nieuwe stages
 * vanuit het programma toe te voegen.
 */

interface StageOption {
  id: string;
  name: string;
  color: string | null;
}

export function GroupStagesField({
  tenantId,
  groupId,
  programId,
  programName,
  useStages,
  available,
  attachedStageIds,
  label,
  helpText,
}: {
  tenantId: string;
  groupId: string;
  programId: string | null;
  programName: string | null;
  useStages: boolean;
  available: StageOption[];
  attachedStageIds: string[];
  label: string;
  helpText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [pickStage, setPickStage] = useState<string>("");

  const attachedSet = new Set(attachedStageIds);
  const attached = available.filter((s) => attachedSet.has(s.id));
  const selectable = available.filter((s) => !attachedSet.has(s.id));

  function onAttach() {
    if (!pickStage) return;
    setErr(null);
    startTransition(async () => {
      const res = await attachGroupStage({
        tenant_id: tenantId,
        group_id: groupId,
        stage_id: pickStage,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setPickStage("");
      router.refresh();
    });
  }

  function onDetach(stageId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await detachGroupStage({
        tenant_id: tenantId,
        group_id: groupId,
        stage_id: stageId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (!programId) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>{label}:</span>
        <span style={{ color: "var(--text-secondary)" }}>
          koppel deze groep eerst aan een programma
        </span>
      </div>
    );
  }

  if (!useStages) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>{label}:</span>
        <span style={{ color: "var(--text-secondary)" }}>
          stages staan uit op programma
          {programName ? ` "${programName}"` : ""} — schakel ze aan op de
          programma-detailpagina om hier stages te kunnen koppelen
        </span>
      </div>
    );
  }

  if (available.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>{label}:</span>
        <span style={{ color: "var(--text-secondary)" }}>
          nog geen stages aangemaakt in programma
          {programName ? ` "${programName}"` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span style={{ color: "var(--text-secondary)" }}>{label}:</span>
      {attached.length === 0 ? (
        <span style={{ color: "var(--text-secondary)" }}>—</span>
      ) : (
        attached.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: s.color ?? "var(--surface-soft)",
              color: s.color ? "white" : "var(--text-primary)",
            }}
          >
            {s.name}
            <button
              type="button"
              onClick={() => onDetach(s.id)}
              disabled={pending}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-black/15 disabled:opacity-50"
              aria-label={`Stage ${s.name} ontkoppelen`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))
      )}
      {selectable.length > 0 && (
        <>
          <select
            value={pickStage}
            onChange={(e) => setPickStage(e.target.value)}
            disabled={pending}
            className="h-7 rounded-lg border bg-transparent px-2 text-[11px] outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
            aria-label="Stage selecteren om toe te voegen"
          >
            <option value="">+ stage…</option>
            {selectable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {pickStage && (
            <button
              type="button"
              onClick={onAttach}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-primary)",
              }}
            >
              <Plus className="h-3 w-3" /> Toevoegen
            </button>
          )}
        </>
      )}
      {err && <span className="text-red-600">{err}</span>}
      {helpText && (
        <span style={{ color: "var(--text-secondary)" }}>· {helpText}</span>
      )}
    </div>
  );
}
