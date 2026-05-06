import { Receipt } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { UpcomingPaymentCard } from "@/components/tenant/upcoming-payment-card";
import {
  computeUpcomingPayment,
  pickVisibleUpcoming,
} from "@/lib/payments/upcoming";
import type {
  MemberMembership,
  MembershipPaymentLog,
  MembershipPlan,
  PaymentMethod,
} from "@/types/database";

export interface PaymentsTabProps {
  memberships: Array<MemberMembership & { plan: MembershipPlan | null }>;
  payments: MembershipPaymentLog[];
  paymentMethods: PaymentMethod[];
}

function fmtPrice(p: number | null): string {
  if (p === null || Number.isNaN(p)) return "—";
  return `€ ${p.toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const PERIOD_LABEL: Record<string, string> = {
  maand: "Maand",
  jaar: "Jaar",
  anders: "Anders",
};

export function PaymentsTab({ memberships, payments, paymentMethods }: PaymentsTabProps) {
  const upcoming = pickVisibleUpcoming(
    memberships.map((m) =>
      computeUpcomingPayment({
        membership: m,
        plan: m.plan,
        paymentMethods,
        payments,
      }),
    ),
  );

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {upcoming.map((u) => (
            <UpcomingPaymentCard key={u.member_membership_id + u.due_date} upcoming={u} />
          ))}
        </div>
      )}

      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2
          className="mb-3 inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          <Receipt className="h-4 w-4" /> Betaalhistorie
        </h2>
        {payments.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen betalingen geregistreerd.
          </p>
        ) : (
          <div
            className="overflow-x-auto rounded-xl border"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "var(--surface-soft)" }}>
                <tr
                  className="text-left text-[11px] uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <th className="px-3 py-2">Vervaldatum</th>
                  <th className="px-3 py-2">Periode</th>
                  <th className="px-3 py-2">Verwacht</th>
                  <th className="px-3 py-2">Betaald</th>
                  <th className="px-3 py-2">Restant</th>
                  <th className="px-3 py-2">Methode</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const expected = p.amount_expected ?? p.amount ?? 0;
                  const paid = p.amount_paid ?? p.amount ?? 0;
                  const restant = Math.max(0, expected - paid);
                  const pm = p.paid_via_payment_method_id
                    ? paymentMethods.find((m) => m.id === p.paid_via_payment_method_id)
                    : null;
                  return (
                    <tr key={p.id} className="border-t" style={{ borderColor: "var(--surface-border)" }}>
                      <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                        {fmtDate(p.due_date)}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                        {p.period ? PERIOD_LABEL[p.period] ?? p.period : "—"}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                        {fmtPrice(p.amount_expected ?? p.amount)}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                        {fmtPrice(p.amount_paid ?? p.amount)}
                      </td>
                      <td className="px-3 py-2">
                        {restant > 0 ? (
                          <span className="font-semibold text-orange-700">
                            {fmtPrice(restant)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-secondary)" }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                        {pm?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
