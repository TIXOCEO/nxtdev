"use client";

import { useState, useTransition } from "react";
import { chooseProposedSlot } from "@/lib/actions/public/propose-slot";

export interface ProposalRow {
  group_id: string;
  stage_id: string | null;
  group_name: string;
  total_score: number;
  capacity_match: number;
  wait_weeks: number | null;
  wait_label: string;
  wait_tone: "green" | "yellow" | "red";
  suggestion_rank: number;
}

function toneColors(tone: "green" | "yellow" | "red") {
  if (tone === "green") return { bg: "#dcfce7", fg: "#166534" };
  if (tone === "yellow") return { bg: "#fef9c3", fg: "#854d0e" };
  return { bg: "#fee2e2", fg: "#991b1b" };
}

export function ChooseSlotList({
  rows,
  reviewToken,
}: {
  rows: ProposalRow[];
  reviewToken: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  function choose(row: ProposalRow) {
    setError(null);
    setChosen(row.group_id);
    startTransition(async () => {
      const res = await chooseProposedSlot({
        reviewToken,
        groupId: row.group_id,
        suggestionRank: row.suggestion_rank,
        suggestionScore: row.total_score,
      });
      if (res.ok) {
        window.location.assign(res.redirectUrl);
      } else {
        setError(res.error);
        setChosen(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const tone = toneColors(row.wait_tone);
        const isChosen = chosen === row.group_id;
        const disabled = pending || row.capacity_match === 0;
        return (
          <button
            key={row.group_id}
            type="button"
            onClick={() => choose(row)}
            disabled={disabled}
            className="block w-full rounded-2xl p-4 text-left transition"
            style={{
              backgroundColor: "var(--surface)",
              border: `1px solid ${isChosen ? "var(--tenant-accent)" : "var(--border)"}`,
              opacity: disabled && !isChosen ? 0.6 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div
                  className="text-base font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {row.group_name}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Voorstel #{row.suggestion_rank}
                </div>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ backgroundColor: tone.bg, color: tone.fg }}
              >
                {row.wait_label}
              </span>
            </div>
            {row.capacity_match === 0 ? (
              <div
                className="mt-3 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Geen directe plek — alleen via wachtlijst.
              </div>
            ) : null}
          </button>
        );
      })}
      {error ? (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
