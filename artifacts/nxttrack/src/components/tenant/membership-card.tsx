import { CalendarDays, CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MemberMembership, MembershipPlan } from "@/types/database";

export interface MembershipCardProps {
  membership: MemberMembership;
  plan: MembershipPlan | null;
}

const BILLING_LABELS: Record<string, string> = {
  monthly: "per maand",
  quarterly: "per kwartaal",
  yearly: "per jaar",
  custom: "custom",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  // Format the SQL `date` value as a calendar date without going through
  // `new Date(...)`, which would otherwise apply the browser timezone and
  // can shift the displayed day by one.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function fmtPrice(p: number | null): string {
  if (p === null || Number.isNaN(p)) return "—";
  return `€ ${p.toFixed(2).replace(".", ",")}`;
}

export function MembershipCard({ membership, plan }: MembershipCardProps) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            <CreditCard className="h-4 w-4" />
            {plan?.name ?? "Onbekend abonnement"}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            {fmtPrice(plan?.price ?? null)}{" "}
            {plan?.billing_period ? BILLING_LABELS[plan.billing_period] ?? plan.billing_period : ""}
          </p>
        </div>
        <StatusBadge status={membership.status} />
      </div>
      <div
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> Start {fmtDate(membership.start_date)}
        </span>
        <span>·</span>
        <span>Einde {fmtDate(membership.end_date)}</span>
      </div>
    </div>
  );
}
