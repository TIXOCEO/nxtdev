/**
 * Sprint 73 — Submission audit-timeline.
 *
 * Toont een chronologisch overzicht van alle status-transities en
 * stage-keuzes voor deze submission. Server component: rendert
 * statisch op basis van de audit-rijen die door de detail-page worden
 * binnengehaald.
 */

type Json = Record<string, unknown>;

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export interface SubmissionAuditRow {
  id: string;
  action: string;
  meta: Json;
  actor_email: string | null;
  created_at: string;
}

interface Props {
  rows: SubmissionAuditRow[];
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Ingediend",
  in_review: "In beoordeling",
  needs_review: "Vereist beoordeling",
  waitlisted: "Wachtlijst",
  placed: "Geplaatst",
  rejected: "Afgewezen",
  converted: "Omgezet",
};

function statusLabel(s: unknown): string {
  return typeof s === "string" ? STATUS_LABEL[s] ?? s : "—";
}

function describeRow(row: SubmissionAuditRow): string {
  const m = row.meta ?? {};
  switch (row.action) {
    case "intake.submission.reviewed":
      return `Beoordeling gestart (${statusLabel(m.from_status)} → ${statusLabel(m.to_status)})`;
    case "intake.submission.status_changed":
      return `Status gewijzigd: ${statusLabel(m.from_status)} → ${statusLabel(m.to_status)}`;
    case "intake.submission.rejected":
      return `Afgewezen (${statusLabel(m.from_status)} → afgewezen)`;
    case "intake.submission.placed":
      return `Geplaatst in groep ${typeof m.group_name === "string" ? m.group_name : ""} (${statusLabel(m.from_status)} → geplaatst)`;
    case "intake.submission.stage_selected":
      return typeof m.stage_name === "string" && m.stage_name
        ? `Stage gekozen: ${m.stage_name}`
        : "Stage-keuze teruggenomen";
    default:
      return row.action;
  }
}

export function SubmissionHistory({ rows }: Props) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-base font-semibold">Geschiedenis</h2>
      {rows.length === 0 ? (
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Nog geen wijzigingen vastgelegd.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((r) => {
            const reason =
              typeof r.meta?.reason === "string" && r.meta.reason !== ""
                ? (r.meta.reason as string)
                : null;
            return (
              <li
                key={r.id}
                className="flex flex-col gap-0.5 border-l-2 pl-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-sm">{describeRow(r)}</div>
                <div
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatDateTime(r.created_at)}
                  {r.actor_email ? ` • ${r.actor_email}` : ""}
                </div>
                {reason ? (
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Reden: {reason}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
