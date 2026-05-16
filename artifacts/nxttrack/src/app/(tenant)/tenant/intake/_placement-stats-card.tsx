import { getPlacementFollowupStats } from "@/lib/intake/placement-stats";

/**
 * Sprint 71 — Plaatsings-opvolg-statistieken op /tenant/intake.
 *
 * Eén consistent cohort: audit_logs-rijen met
 * action='intake.submission.placed', gefilterd op het
 * plaatsings-event-datumbereik (NIET op submission-creatie).
 *
 * KPI's:
 *   - aantal plaatsingen via paneel-knop vs totaal
 *   - gemiddelde suggestie-rank en -score
 *   - gemiddelde tijd-tot-plaatsing (uren, alleen voor audit-rijen
 *     met submission_id in meta — Sprint 71+)
 *   - % plaatsingen waarvoor top-5 max-score ≤ 20 (Sprint 71 vastgelegd
 *     in audit-meta `top5_max_score`)
 */

interface Props {
  tenantId: string;
  from?: string;
  to?: string;
}

function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`;
}

function formatNum(v: number | null): string {
  if (v == null) return "—";
  return `${v.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}`;
}

function formatHours(v: number | null): string {
  if (v == null) return "—";
  if (v < 24) return `${v.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} u`;
  const days = v / 24;
  return `${days.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} d`;
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ backgroundColor: "var(--bg-elevated, var(--surface))", border: "1px solid var(--border)" }}
    >
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint ? (
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export async function PlacementStatsCard({ tenantId, from, to }: Props) {
  const stats = await getPlacementFollowupStats(tenantId, { from, to });

  const fromLabel = new Date(stats.rangeFrom).toLocaleDateString("nl-NL");
  const toLabel = new Date(stats.rangeTo).toLocaleDateString("nl-NL");

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Plaatsings-opvolging</h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Plaatsingsdatum {fromLabel} – {toLabel}
        </span>
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        Hoe vaak volgen admins de placement-suggesties op? Cijfers
        gebaseerd op <code>intake.submission.placed</code>-audit-events
        in het datumbereik (filter slaat op de plaatsingsdatum, niet de
        submission-datum).
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="Plaatsingen totaal"
          value={stats.totalPlacements.toLocaleString("nl-NL")}
        />
        <Tile
          label="Via paneel-knop"
          value={stats.placementsViaPanel.toLocaleString("nl-NL")}
          hint={stats.panelSharePct != null ? `${formatPct(stats.panelSharePct)} van totaal` : undefined}
        />
        <Tile
          label="Gem. suggestie-rang"
          value={formatNum(stats.avgSuggestionRank)}
          hint="1 = top-suggestie"
        />
        <Tile
          label="Gem. suggestie-score"
          value={formatNum(stats.avgSuggestionScore)}
          hint="0–100 (hoger = beter)"
        />
        <Tile
          label="Gem. tijd-tot-plaatsing"
          value={formatHours(stats.avgHoursToPlacement)}
          hint={
            stats.hoursSampleSize > 0
              ? `n=${stats.hoursSampleSize}`
              : "Vanaf Sprint 71 vastgelegd"
          }
        />
        <Tile
          label="Top-5 zwak (≤20)"
          value={formatPct(stats.weakTop5SharePct)}
          hint={
            stats.weakTop5SampleSize > 0
              ? `${stats.weakTop5Count} van ${stats.weakTop5SampleSize}`
              : "Vanaf Sprint 71 vastgelegd"
          }
        />
      </div>

      {stats.totalPlacements === 0 ? (
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Nog geen plaatsingen in dit datumbereik.
        </p>
      ) : null}
    </div>
  );
}
