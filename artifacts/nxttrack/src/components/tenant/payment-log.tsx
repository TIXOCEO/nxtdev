import { ReceiptText } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MembershipPaymentLog } from "@/types/database";

export interface PaymentLogProps {
  payments: MembershipPaymentLog[];
}

function fmtPrice(p: number | null): string {
  if (p === null || Number.isNaN(p)) return "-";
  return `EUR ${p.toFixed(2).replace(".", ",")}`;
}

function fmtTs(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("nl-NL");
}

export function PaymentLog({ payments }: PaymentLogProps) {
  if (payments.length === 0) {
    return (
      <p className="rounded-2xl border p-4 text-xs" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)", color: "var(--text-secondary)" }}>
        Nog geen betalingen geregistreerd.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {payments.map((p) => (
        <li
          key={p.id}
          className="nxt-shell-hover flex flex-col gap-3 rounded-[18px] border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-strong) 84%, transparent), var(--shell-panel-bg))",
            borderColor: "var(--shell-border)",
            boxShadow: "var(--shell-shadow-card)",
          }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                borderColor: "var(--shell-border)",
                backgroundColor: "var(--shell-panel-muted)",
                color: "var(--shell-info)",
              }}
            >
              <ReceiptText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-black" style={{ color: "var(--text-primary)" }}>
                {fmtPrice(p.amount)}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                {p.paid_at ? `Betaald ${fmtTs(p.paid_at)}` : `Genoteerd ${fmtTs(p.created_at)}`}
                {p.note ? ` - ${p.note}` : ""}
              </p>
            </div>
          </div>
          <StatusBadge status={p.status} />
        </li>
      ))}
    </ul>
  );
}
