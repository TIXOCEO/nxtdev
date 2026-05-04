import { StatusBadge } from "@/components/ui/status-badge";
import type { MembershipPaymentLog } from "@/types/database";

export interface PaymentLogProps {
  payments: MembershipPaymentLog[];
}

function fmtPrice(p: number | null): string {
  if (p === null || Number.isNaN(p)) return "—";
  return `€ ${p.toFixed(2).replace(".", ",")}`;
}

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL");
}

export function PaymentLog({ payments }: PaymentLogProps) {
  if (payments.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Nog geen betalingen geregistreerd.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {payments.map((p) => (
        <li
          key={p.id}
          className="flex flex-col gap-1 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div className="min-w-0">
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>
              {fmtPrice(p.amount)}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {p.paid_at ? `Betaald ${fmtTs(p.paid_at)}` : `Genoteerd ${fmtTs(p.created_at)}`}
              {p.note ? ` · ${p.note}` : ""}
            </p>
          </div>
          <StatusBadge status={p.status} />
        </li>
      ))}
    </ul>
  );
}
