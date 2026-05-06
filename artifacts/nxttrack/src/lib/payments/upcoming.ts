import type {
  MemberMembership,
  MembershipPaymentLog,
  MembershipPlan,
  PaymentMethod,
  PaymentPeriod,
} from "@/types/database";

export interface UpcomingPayment {
  /** Het member_membership waar de aankomende betaling bij hoort. */
  member_membership_id: string;
  membership_plan_id: string | null;
  plan_name: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  amount: number | null;
  due_date: string; // yyyy-mm-dd
  /** Wanneer dit een nog openstaand restant van een eerdere betaling betreft. */
  is_restant: boolean;
  /** De brondaver-rij wanneer is_restant=true. */
  source_payment_id: string | null;
  period: PaymentPeriod | string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseIsoDate(s: string): Date {
  // Force UTC midnight to avoid TZ drift when comparing dates.
  return new Date(`${s}T00:00:00Z`);
}

function addPeriod(d: Date, period: PaymentPeriod | string | null): Date {
  const next = new Date(d.getTime());
  switch (period) {
    case "maand":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "jaar":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    default:
      // 'anders' of null → 1 maand als pragmatische default zodat de
      // tegel ergens uitkomt; tenant-admin kan zelf een due_date zetten.
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }
  return next;
}

function periodFromBilling(b: string | null | undefined): PaymentPeriod {
  switch (b) {
    case "yearly":
      return "jaar";
    case "monthly":
      return "maand";
    default:
      return "anders";
  }
}

export function billingToPeriod(
  b: string | null | undefined,
): PaymentPeriod {
  return periodFromBilling(b);
}

export function isWithinDays(iso: string, days: number, now = new Date()): boolean {
  const target = parseIsoDate(iso).getTime();
  const ref = parseIsoDate(now.toISOString().slice(0, 10)).getTime();
  return target - ref <= days * DAY_MS;
}

/**
 * Bepaalt de aankomende betaling voor één actief member_membership.
 * - Een rij met openstaand restant (status 'partial' of 'due' met
 *   amount_paid < amount_expected) krijgt voorrang.
 * - Anders: laatste volledig-betaalde periode + interval(period|plan.billing).
 * Geeft `null` wanneer er geen actief membership of geen prijs/periode is.
 */
export function computeUpcomingPayment(opts: {
  membership: MemberMembership;
  plan: MembershipPlan | null;
  paymentMethods: PaymentMethod[];
  payments: MembershipPaymentLog[];
}): UpcomingPayment | null {
  const { membership, plan, paymentMethods, payments } = opts;
  if (membership.status !== "active") return null;

  const ofMembership = payments
    .filter((p) => p.member_membership_id === membership.id)
    .sort((a, b) => (b.due_date ?? b.paid_at ?? b.created_at).localeCompare(
      a.due_date ?? a.paid_at ?? a.created_at,
    ));

  // 1. Restant van een 'partial'-rij krijgt voorrang.
  const partial = ofMembership.find(
    (p) =>
      (p.status === "partial" ||
        ((p.amount_paid ?? 0) > 0 &&
          (p.amount_expected ?? 0) > (p.amount_paid ?? 0))) &&
      (p.amount_expected ?? 0) > (p.amount_paid ?? 0),
  );
  if (partial) {
    const remaining =
      (partial.amount_expected ?? 0) - (partial.amount_paid ?? 0);
    const pm = paymentMethods.find(
      (m) => m.id === partial.paid_via_payment_method_id,
    );
    return {
      member_membership_id: membership.id,
      membership_plan_id: partial.membership_plan_id ?? plan?.id ?? null,
      plan_name: plan?.name ?? null,
      payment_method_id: partial.paid_via_payment_method_id,
      payment_method_name: pm?.name ?? null,
      amount: remaining,
      due_date: partial.due_date ?? todayIsoDate(),
      is_restant: true,
      source_payment_id: partial.id,
      period: partial.period ?? periodFromBilling(plan?.billing_period ?? null),
    };
  }

  // 2. Een nog openstaande 'due'-rij in de toekomst.
  const due = ofMembership.find(
    (p) => p.status === "due" && p.due_date,
  );
  if (due) {
    const pm = paymentMethods.find(
      (m) => m.id === due.paid_via_payment_method_id,
    );
    return {
      member_membership_id: membership.id,
      membership_plan_id: due.membership_plan_id ?? plan?.id ?? null,
      plan_name: plan?.name ?? null,
      payment_method_id: due.paid_via_payment_method_id,
      payment_method_name: pm?.name ?? null,
      amount: due.amount_expected ?? plan?.price ?? null,
      due_date: due.due_date ?? todayIsoDate(),
      is_restant: false,
      source_payment_id: due.id,
      period: due.period ?? periodFromBilling(plan?.billing_period ?? null),
    };
  }

  // 3. Volgende verwachte vervaldatum = max(due_date van paid) + period.
  const lastPaid = ofMembership
    .filter((p) => p.status === "paid" && (p.due_date || p.paid_at))
    .sort((a, b) =>
      (b.due_date ?? b.paid_at ?? "").localeCompare(
        a.due_date ?? a.paid_at ?? "",
      ),
    )[0];

  let nextDue: Date | null = null;
  let period: PaymentPeriod = periodFromBilling(plan?.billing_period ?? null);
  if (lastPaid) {
    period =
      (lastPaid.period as PaymentPeriod | null) ??
      periodFromBilling(plan?.billing_period ?? null);
    const ref = lastPaid.due_date
      ? parseIsoDate(lastPaid.due_date)
      : lastPaid.paid_at
        ? new Date(lastPaid.paid_at)
        : null;
    if (ref) nextDue = addPeriod(ref, period);
  } else if (membership.start_date) {
    nextDue = parseIsoDate(membership.start_date);
  }

  if (!nextDue || !plan) return null;

  return {
    member_membership_id: membership.id,
    membership_plan_id: plan.id,
    plan_name: plan.name,
    payment_method_id: null,
    payment_method_name: null,
    amount: plan.price,
    due_date: nextDue.toISOString().slice(0, 10),
    is_restant: false,
    source_payment_id: null,
    period,
  };
}

/** Geeft alle aankomende-betaling tegels die binnen 14 dagen vallen of een restant betreffen. */
export function pickVisibleUpcoming(
  list: Array<UpcomingPayment | null>,
  windowDays = 14,
): UpcomingPayment[] {
  const out: UpcomingPayment[] = [];
  for (const u of list) {
    if (!u) continue;
    if (u.is_restant) {
      out.push(u);
      continue;
    }
    if (isWithinDays(u.due_date, windowDays)) out.push(u);
  }
  return out;
}
