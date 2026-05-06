import { CalendarClock, AlertCircle } from "lucide-react";
import type { UpcomingPayment } from "@/lib/payments/upcoming";

function fmtPrice(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  return `€ ${p.toFixed(2).replace(".", ",")}`;
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
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: upcoming.is_restant
          ? "color-mix(in oklab, #fb923c 20%, var(--surface-main))"
          : overdue
            ? "color-mix(in oklab, #ef4444 18%, var(--surface-main))"
            : "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <p
        className="inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {upcoming.is_restant ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <CalendarClock className="h-4 w-4" />
        )}
        {upcoming.is_restant ? "Openstaand restant" : "Aankomende betaling"}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {upcoming.plan_name ?? "Abonnement"}
      </p>
      <div className="mt-3 grid gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        <p>
          <span className="font-medium">{fmtPrice(upcoming.amount)}</span>{" "}
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            verwacht {fmtDate(upcoming.due_date)}
          </span>
        </p>
        <p className="text-xs" style={{ color: overdue ? "#b91c1c" : "var(--text-secondary)" }}>
          {overdue
            ? `${Math.abs(days)} dagen achterstallig`
            : days === 0
              ? "Vandaag"
              : `Over ${days} ${days === 1 ? "dag" : "dagen"}`}
        </p>
        {upcoming.payment_method_name && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Methode: {upcoming.payment_method_name}
          </p>
        )}
      </div>
    </div>
  );
}
