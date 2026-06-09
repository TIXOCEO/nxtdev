import { AlertCircle, CalendarClock } from "lucide-react";
import type { UpcomingPayment } from "@/lib/payments/upcoming";

function fmtPrice(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "-";
  return `EUR ${p.toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

export function UpcomingPaymentCard({ upcoming }: { upcoming: UpcomingPayment }) {
  const days = daysUntil(upcoming.due_date);
  const overdue = days < 0;
  const tone = upcoming.is_restant ? "var(--shell-warning)" : overdue ? "var(--shell-danger)" : "var(--shell-info)";
  const Icon = upcoming.is_restant ? AlertCircle : CalendarClock;

  return (
    <div
      className="nxt-shell-hover rounded-[20px] border p-4"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-strong) 82%, transparent), var(--shell-panel-bg))",
        borderColor: overdue || upcoming.is_restant ? tone : "var(--shell-border)",
        boxShadow: "var(--shell-shadow-card)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border"
          style={{
            borderColor: "var(--shell-border)",
            backgroundColor: "var(--shell-panel-muted)",
            color: tone,
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            {upcoming.is_restant ? "Openstaand restant" : "Aankomende betaling"}
          </p>
          <p className="mt-1 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
            {upcoming.plan_name ?? "Abonnement"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border px-3 py-2" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)" }}>
        <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
          {fmtPrice(upcoming.amount)}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Verwacht {fmtDate(upcoming.due_date)}
        </p>
        <p className="mt-1 text-xs font-bold" style={{ color: tone }}>
          {overdue
            ? `${Math.abs(days)} dagen achterstallig`
            : days === 0
              ? "Vandaag"
              : `Over ${days} ${days === 1 ? "dag" : "dagen"}`}
        </p>
        {upcoming.payment_method_name && (
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Methode: {upcoming.payment_method_name}
          </p>
        )}
      </div>
    </div>
  );
}
