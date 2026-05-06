"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Receipt, Trash2, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  createMembershipPayment,
  updateMembershipPayment,
  deleteMembershipPayment,
} from "@/lib/actions/tenant/payments";
import { PAYMENT_PERIODS } from "@/lib/validation/payments";
import { billingToPeriod } from "@/lib/payments/upcoming";
import type {
  MemberMembership,
  MembershipPaymentLog,
  MembershipPlan,
  PaymentMethod,
  PaymentPeriod,
} from "@/types/database";

type MembershipWithPlan = MemberMembership & { plan: MembershipPlan | null };

export interface PaymentsTableProps {
  tenantId: string;
  memberId: string;
  memberships: MembershipWithPlan[];
  payments: MembershipPaymentLog[];
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string | null;
}

interface FormState {
  member_membership_id: string;
  membership_plan_id: string;
  paid_via_payment_method_id: string;
  amount_expected: string;
  amount_paid: string;
  period: PaymentPeriod | "";
  paid_at: string;
  due_date: string;
  note: string;
  parent_payment_id: string | null;
  audit_note: string;
}

const PERIOD_LABEL: Record<string, string> = {
  maand: "Maand",
  jaar: "Jaar",
  anders: "Anders",
};

function fmtPrice(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  return `€ ${p.toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(
  memberships: MembershipWithPlan[],
  defaultPmId: string | null,
): FormState {
  const first = memberships[0];
  return {
    member_membership_id: first?.id ?? "",
    membership_plan_id: first?.plan?.id ?? "",
    paid_via_payment_method_id: defaultPmId ?? "",
    amount_expected: first?.plan?.price != null ? String(first.plan.price) : "",
    amount_paid: first?.plan?.price != null ? String(first.plan.price) : "",
    period: first?.plan?.billing_period
      ? billingToPeriod(first.plan.billing_period)
      : "maand",
    paid_at: todayIso(),
    due_date: todayIso(),
    note: "",
    parent_payment_id: null,
    audit_note: "",
  };
}

export function PaymentsTable({
  tenantId,
  memberId,
  memberships,
  payments,
  paymentMethods,
  defaultPaymentMethodId,
}: PaymentsTableProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<MembershipPaymentLog | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(memberships, defaultPaymentMethodId));
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MembershipPaymentLog | null>(null);
  const [deleteNote, setDeleteNote] = useState("");

  const planLookup = useMemo(() => {
    const m = new Map<string, MembershipPlan | null>();
    for (const mm of memberships) m.set(mm.id, mm.plan ?? null);
    return m;
  }, [memberships]);

  const pmLookup = useMemo(() => {
    const m = new Map<string, PaymentMethod>();
    for (const pm of paymentMethods) m.set(pm.id, pm);
    return m;
  }, [paymentMethods]);

  function openCreate(prefill?: Partial<FormState>) {
    setEditing(null);
    setErr(null);
    setForm({ ...emptyForm(memberships, defaultPaymentMethodId), ...prefill });
    setCreating(true);
  }

  function openRestant(payment: MembershipPaymentLog) {
    const remaining =
      (payment.amount_expected ?? 0) - (payment.amount_paid ?? 0);
    openCreate({
      member_membership_id: payment.member_membership_id,
      membership_plan_id: payment.membership_plan_id ?? "",
      paid_via_payment_method_id:
        payment.paid_via_payment_method_id ?? defaultPaymentMethodId ?? "",
      amount_expected: remaining > 0 ? remaining.toFixed(2) : "",
      amount_paid: remaining > 0 ? remaining.toFixed(2) : "",
      period: (payment.period as PaymentPeriod | null) ?? "anders",
      paid_at: todayIso(),
      due_date: payment.due_date ?? todayIso(),
      note: `Restant van ${fmtDate(payment.due_date)}`,
      parent_payment_id: payment.id,
      audit_note: "",
    });
  }

  function openEdit(p: MembershipPaymentLog) {
    setCreating(false);
    setErr(null);
    setForm({
      member_membership_id: p.member_membership_id,
      membership_plan_id: p.membership_plan_id ?? "",
      paid_via_payment_method_id: p.paid_via_payment_method_id ?? "",
      amount_expected: p.amount_expected != null ? String(p.amount_expected) : "",
      amount_paid: p.amount_paid != null ? String(p.amount_paid) : "",
      period: (p.period as PaymentPeriod | null) ?? "",
      paid_at: p.paid_at?.slice(0, 10) ?? "",
      due_date: p.due_date ?? "",
      note: p.note ?? "",
      parent_payment_id: p.parent_payment_id ?? null,
      audit_note: "",
    });
    setEditing(p);
  }

  function close() {
    setEditing(null);
    setCreating(false);
    setErr(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      if (editing) {
        if (form.audit_note.trim().length < 3) {
          setErr("Notitie is verplicht bij wijzigen.");
          return;
        }
        const res = await updateMembershipPayment({
          tenant_id: tenantId,
          id: editing.id,
          member_membership_id: form.member_membership_id,
          membership_plan_id: form.membership_plan_id || null,
          paid_via_payment_method_id: form.paid_via_payment_method_id || null,
          amount_expected: form.amount_expected,
          amount_paid: form.amount_paid,
          period: (form.period || null) as PaymentPeriod | null,
          paid_at: form.paid_at,
          due_date: form.due_date,
          parent_payment_id: form.parent_payment_id,
          note: form.note,
          audit_note: form.audit_note,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
      } else {
        const res = await createMembershipPayment({
          tenant_id: tenantId,
          member_membership_id: form.member_membership_id,
          membership_plan_id: form.membership_plan_id || null,
          paid_via_payment_method_id: form.paid_via_payment_method_id || null,
          amount_expected: form.amount_expected,
          amount_paid: form.amount_paid,
          period: (form.period || null) as PaymentPeriod | null,
          paid_at: form.paid_at,
          due_date: form.due_date,
          parent_payment_id: form.parent_payment_id,
          note: form.note,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
      }
      close();
      router.refresh();
    });
  }

  function doDelete() {
    if (!confirmDelete) return;
    if (deleteNote.trim().length < 3) {
      setErr("Notitie is verplicht bij verwijderen.");
      return;
    }
    start(async () => {
      const res = await deleteMembershipPayment({
        tenant_id: tenantId,
        id: confirmDelete.id,
        audit_note: deleteNote,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setConfirmDelete(null);
      setDeleteNote("");
      router.refresh();
    });
  }

  void memberId;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          Betalingen ({payments.length})
        </p>
        {!creating && !editing && memberships.length > 0 && (
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Voeg betaling toe
          </button>
        )}
      </div>

      {(creating || editing) && (
        <form
          onSubmit={submit}
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              {editing ? "Bewerk betaling" : "Nieuwe betaling"}
              {form.parent_payment_id && !editing ? " · restant" : ""}
            </p>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <X className="h-3.5 w-3.5" /> Annuleer
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Abonnement" required>
              <select
                value={form.member_membership_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const plan = planLookup.get(id) ?? null;
                  setForm({
                    ...form,
                    member_membership_id: id,
                    membership_plan_id: plan?.id ?? "",
                    period: plan?.billing_period
                      ? billingToPeriod(plan.billing_period)
                      : form.period,
                  });
                }}
                className={inputCls}
                required
              >
                {memberships.map((mm) => (
                  <option key={mm.id} value={mm.id}>
                    {mm.plan?.name ?? "—"} ({mm.status})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Periode">
              <select
                value={form.period}
                onChange={(e) =>
                  setForm({ ...form, period: e.target.value as PaymentPeriod | "" })
                }
                className={inputCls}
              >
                <option value="">—</option>
                {PAYMENT_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vervaldatum">
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Betaaldatum">
              <input
                type="date"
                value={form.paid_at}
                onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Verwacht bedrag (€)">
              <input
                inputMode="decimal"
                value={form.amount_expected}
                onChange={(e) => setForm({ ...form, amount_expected: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Ontvangen bedrag (€)" hint="Lager dan verwacht = 'partial' (restant blijft open).">
              <input
                inputMode="decimal"
                value={form.amount_paid}
                onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Betaalmethode">
              <select
                value={form.paid_via_payment_method_id}
                onChange={(e) =>
                  setForm({ ...form, paid_via_payment_method_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">— geen —</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notitie" hint="Optioneel.">
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className={inputCls}
              />
            </Field>
            {editing && (
              <Field
                label="Audit-notitie (verplicht)"
                hint="Wordt vastgelegd in de auditlog van deze betaling."
                required
              >
                <input
                  value={form.audit_note}
                  onChange={(e) => setForm({ ...form, audit_note: e.target.value })}
                  required
                  minLength={3}
                  className={inputCls}
                />
              </Field>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            {err && <span className="text-xs text-red-600">{err}</span>}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              {pending ? "Bezig…" : editing ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </form>
      )}

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
              <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                <Th>Vervaldatum</Th>
                <Th>Periode</Th>
                <Th>Verwacht</Th>
                <Th>Betaald</Th>
                <Th>Restant</Th>
                <Th>Methode</Th>
                <Th>Status</Th>
                <Th className="text-right">Acties</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const expected = p.amount_expected ?? p.amount ?? 0;
                const paid = p.amount_paid ?? p.amount ?? 0;
                const restant = Math.max(0, expected - paid);
                const pm = p.paid_via_payment_method_id
                  ? pmLookup.get(p.paid_via_payment_method_id)
                  : null;
                return (
                  <tr key={p.id} className="border-t" style={{ borderColor: "var(--surface-border)" }}>
                    <Td>{fmtDate(p.due_date)}</Td>
                    <Td>{p.period ? PERIOD_LABEL[p.period] ?? p.period : "—"}</Td>
                    <Td>{fmtPrice(p.amount_expected ?? p.amount)}</Td>
                    <Td>{fmtPrice(p.amount_paid ?? p.amount)}</Td>
                    <Td>
                      {restant > 0 ? (
                        <span className="font-semibold text-orange-700">{fmtPrice(restant)}</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>{pm?.name ?? "—"}</Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {restant > 0 && (
                          <button
                            type="button"
                            onClick={() => openRestant(p)}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px]"
                            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                          >
                            <Receipt className="h-3 w-3" /> Restant
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                          style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                          aria-label="Bewerk"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDelete(p);
                            setDeleteNote("");
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                          style={{ borderColor: "var(--surface-border)", color: "#b91c1c" }}
                          aria-label="Verwijder"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "color-mix(in oklab, #ef4444 12%, var(--surface-main))",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Verwijder betaling van {fmtDate(confirmDelete.due_date)} ({fmtPrice(confirmDelete.amount_paid ?? confirmDelete.amount)})?
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Notitie is verplicht en wordt vastgelegd in de auditlog.
          </p>
          <input
            value={deleteNote}
            onChange={(e) => setDeleteNote(e.target.value)}
            placeholder="Bijv. 'Dubbel geboekt'"
            className={`${inputCls} mt-2`}
            minLength={3}
          />
          <div className="mt-3 flex justify-end gap-2">
            {err && <span className="text-xs text-red-600">{err}</span>}
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(null);
                setDeleteNote("");
                setErr(null);
              }}
              className="inline-flex h-8 items-center rounded-lg border px-3 text-xs"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              Annuleer
            </button>
            <button
              type="button"
              onClick={doDelete}
              disabled={pending}
              className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold"
              style={{ backgroundColor: "#dc2626", color: "white" }}
            >
              {pending ? "Bezig…" : "Verwijder"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
      {label}
      {required && <span className="text-red-500"> *</span>}
      {children}
      {hint && (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 ${className ?? ""}`}>{children}</th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2 align-middle ${className ?? ""}`} style={{ color: "var(--text-primary)" }}>
      {children}
    </td>
  );
}
