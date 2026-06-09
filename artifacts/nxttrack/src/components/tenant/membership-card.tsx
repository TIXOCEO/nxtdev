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
  if (!iso) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function fmtPrice(p: number | null): string {
  if (p === null || Number.isNaN(p)) return "-";
  return `EUR ${p.toFixed(2).replace(".", ",")}`;
}

export function MembershipCard({ membership, plan }: MembershipCardProps) {
  return (
    <div
      className="nxt-shell-hover rounded-[20px] border p-4"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-strong) 84%, transparent), var(--shell-panel-bg))",
        borderColor: "var(--shell-border)",
        boxShadow: "var(--shell-shadow-card)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="inline-flex min-w-0 items-center gap-2 text-sm font-black"
            style={{ color: "var(--text-primary)" }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                borderColor: "var(--shell-border)",
                backgroundColor:
                  "color-mix(in srgb, var(--tenant-accent, var(--accent)) 12%, var(--shell-panel-muted))",
                color: "var(--shell-info)",
              }}
            >
              <CreditCard className="h-4 w-4" />
            </span>
            <span className="truncate">{plan?.name ?? "Onbekend abonnement"}</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {fmtPrice(plan?.price ?? null)}{" "}
            {plan?.billing_period ? BILLING_LABELS[plan.billing_period] ?? plan.billing_period : ""}
          </p>
        </div>
        <StatusBadge status={membership.status} />
      </div>
      <div
        className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-3 py-2 text-xs"
        style={{
          borderColor: "var(--shell-border)",
          backgroundColor: "var(--shell-panel-muted)",
          color: "var(--text-secondary)",
        }}
      >
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> Start {fmtDate(membership.start_date)}
        </span>
        <span>-</span>
        <span>Einde {fmtDate(membership.end_date)}</span>
      </div>
    </div>
  );
}
