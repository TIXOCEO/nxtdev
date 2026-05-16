"use client";

import { useState, useTransition } from "react";
import type { PlacementCandidate } from "@/lib/db/placement";
import { placeSubmission } from "@/lib/actions/tenant/placements";

/**
 * Sprint 70 — Advisory placement-suggestions paneel.
 *
 * Toont top-5 kandidaat-groepen met total_score (kleurgecodeerd) +
 * 5 componentscores als micro-bars + rationale (expandable).
 * Lege-state-varianten:
 *   - "Geen suggesties beschikbaar" wanneer `candidates.length === 0`.
 *   - Banner "Suggesties beperkt door ontbrekende voorkeuren" wanneer
 *     preferences leeg zijn of date-of-birth ontbreekt (gemeten via
 *     `missingSignals`).
 *   - "Geen geschikte groep gevonden" wanneer alle scores ≤ 20.
 */

export interface PlacementSuggestionsPanelProps {
  submissionId: string;
  candidates: PlacementCandidate[];
  groupNames: Record<string, string>;
  missingSignals: { preferences: boolean; dateOfBirth: boolean };
  /** Alleen tenant-admins mogen daadwerkelijk plaatsen; staff ziet alleen suggesties. */
  canPlace: boolean;
}

const COMPONENT_LABELS: Array<{ key: keyof PlacementCandidate; label: string; rationaleKey: string }> = [
  { key: "capacity_match", label: "Capaciteit", rationaleKey: "capacity" },
  { key: "time_pref_match", label: "Tijd", rationaleKey: "time" },
  { key: "location_pref_match", label: "Locatie", rationaleKey: "location" },
  { key: "age_match", label: "Leeftijd", rationaleKey: "age" },
  { key: "level_match", label: "Niveau", rationaleKey: "level" },
];

function scoreColor(score: number): string {
  if (score >= 70) return "#1f9d55"; // groen
  if (score >= 40) return "#d68910"; // oranje
  return "#c0392b"; // rood
}

export function PlacementSuggestionsPanel({
  submissionId,
  candidates,
  groupNames,
  missingSignals,
  canPlace,
}: PlacementSuggestionsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const top5 = candidates.slice(0, 5);
  const allLow = top5.length > 0 && top5.every((c) => c.total_score <= 20);

  function handlePlace(candidate: PlacementCandidate, rank: number) {
    setBusyGroup(candidate.group_id);
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await placeSubmission({
          submissionId,
          groupId: candidate.group_id,
          suggestionRank: rank,
          suggestionScore: candidate.total_score,
        });
        if (!res.ok) {
          setFeedback(`Plaatsen mislukt: ${res.error ?? "onbekende fout"}`);
        } else {
          setFeedback("Geplaatst.");
        }
      } catch (err) {
        setFeedback(
          `Plaatsen mislukt: ${err instanceof Error ? err.message : "onbekende fout"}`,
        );
      } finally {
        setBusyGroup(null);
      }
    });
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div>
        <h2 className="text-base font-semibold">Plaatsingssuggesties</h2>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Advisory — admin houdt de eindbeslissing.
        </p>
      </div>

      {(missingSignals.preferences || missingSignals.dateOfBirth) && (
        <div
          className="rounded-lg p-3 text-xs"
          style={{ backgroundColor: "var(--warning-soft, #fff8e1)", color: "var(--text-secondary)" }}
        >
          Suggesties zijn beperkt door ontbrekende{" "}
          {missingSignals.preferences ? "voorkeuren" : ""}
          {missingSignals.preferences && missingSignals.dateOfBirth ? " en " : ""}
          {missingSignals.dateOfBirth ? "geboortedatum" : ""}.
        </div>
      )}

      {top5.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Geen kandidaat-groepen gevonden — open de groepenlijst handmatig.
        </p>
      ) : allLow ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Geen geschikte groep gevonden (alle scores ≤ 20). Open de groepenlijst handmatig.
        </p>
      ) : (
        <ul className="space-y-3">
          {top5.map((c, idx) => {
            const rank = idx + 1;
            const isExpanded = expanded === c.group_id;
            const groupName = groupNames[c.group_id] ?? c.group_id.slice(0, 8);
            return (
              <li
                key={c.group_id}
                className="rounded-xl p-3"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{groupName}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: "var(--surface-muted, #eef0f3)" }}
                      >
                        #{rank}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {c.free_seats} vrij
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-5 gap-2">
                      {COMPONENT_LABELS.map(({ key, label }) => {
                        const v = Number(c[key] ?? 0);
                        return (
                          <div key={key} className="flex flex-col">
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {label}
                            </span>
                            <div
                              className="mt-1 h-1.5 rounded-full overflow-hidden"
                              style={{ backgroundColor: "var(--surface-muted, #eef0f3)" }}
                            >
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, v))}%`,
                                  backgroundColor: scoreColor(v),
                                }}
                              />
                            </div>
                            <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                              {Math.round(v)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: scoreColor(c.total_score) }}
                    >
                      {Math.round(c.total_score)}
                    </span>
                    {canPlace ? (
                      <button
                        type="button"
                        onClick={() => handlePlace(c, rank)}
                        disabled={pending && busyGroup === c.group_id}
                        className="rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--accent)",
                          color: "var(--accent-foreground, white)",
                        }}
                      >
                        {pending && busyGroup === c.group_id ? "Bezig…" : "Plaats hier"}
                      </button>
                    ) : (
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Alleen admin
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : c.group_id)}
                      className="text-[11px] underline"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {isExpanded ? "Verberg uitleg" : "Toon uitleg"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <dl
                    className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {COMPONENT_LABELS.map(({ label, rationaleKey }) => (
                      <div key={rationaleKey} className="flex gap-1">
                        <dt className="font-medium">{label}:</dt>
                        <dd>{c.rationale_json[rationaleKey] ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {feedback && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {feedback}
        </p>
      )}
    </div>
  );
}
