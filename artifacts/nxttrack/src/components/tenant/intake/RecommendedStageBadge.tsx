"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSelectedStage } from "@/lib/actions/tenant/submission-status";

/**
 * Sprint 73 — Aanbevolen-stage badge met "Pas aan" popover.
 *
 * Toont de huidige selected_stage (of fallback recommended_stage).
 * Klik op "Pas aan" opent een select met alle program_stages binnen
 * het programma; selectie roept `updateSelectedStage` aan. `null`-keuze
 * via "Geen stage" is toegestaan.
 */

interface Stage {
  id: string;
  name: string;
  color?: string | null;
}

interface Props {
  submissionId: string;
  recommendedStageId: string | null;
  recommendedStageName: string | null;
  selectedStageId: string | null;
  selectedStageName: string | null;
  programStages: Stage[];
}

export function RecommendedStageBadge({
  submissionId,
  recommendedStageId,
  recommendedStageName,
  selectedStageId,
  selectedStageName,
  programStages,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>(selectedStageId ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveId = selectedStageId ?? recommendedStageId;
  const effectiveName = selectedStageName ?? recommendedStageName;
  const sourceLabel = selectedStageId
    ? "Gekozen stage"
    : recommendedStageId
    ? "Aanbevolen stage"
    : "Stage";

  function save() {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await updateSelectedStage({
        submissionId,
        stageId: pick === "" ? null : pick,
      });
      if (!res.ok) {
        setErrorMsg(res.error ?? "Kon stage niet opslaan.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {sourceLabel}
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: "var(--bg-elevated, var(--surface))",
            border: "1px solid var(--border)",
          }}
        >
          {effectiveName ?? "—"}
        </span>
        {programStages.length > 0 ? (
          <button
            type="button"
            className="ml-auto text-xs underline"
            style={{ color: "var(--text-secondary)" }}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Sluiten" : "Pas aan"}
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className="mt-3 rounded-md p-3"
          style={{ backgroundColor: "var(--bg-elevated, var(--surface))", border: "1px solid var(--border)" }}
        >
          <label className="flex flex-col text-xs">
            <span style={{ color: "var(--text-secondary)" }}>Kies stage</span>
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="mt-1 rounded-md border px-2 py-1 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
            >
              <option value="">— Geen stage —</option>
              {programStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {errorMsg ? (
            <p className="mt-2 text-xs" style={{ color: "var(--danger, #c0392b)" }}>
              {errorMsg}
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-foreground, white)",
              }}
            >
              Opslaan
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setPick(selectedStageId ?? "");
              }}
              className="rounded-md px-3 py-1.5 text-xs"
              style={{ border: "1px solid var(--border)" }}
            >
              Annuleren
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
