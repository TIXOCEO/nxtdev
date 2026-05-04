"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Link2, Plus, Receipt } from "lucide-react";
import {
  linkParentChild,
  assignMembershipPlan,
  logMembershipPayment,
} from "@/lib/actions/tenant/members";
import { generateMinorLinkCode } from "@/lib/actions/tenant/invites";

const inputCls =
  "h-9 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
  backgroundColor: "var(--surface-main)",
} as const;
const btnCls =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-50";
const btnStyle = {
  backgroundColor: "var(--accent)",
  color: "var(--text-primary)",
} as const;

// ── Link parent → child ────────────────────────────────────

export interface LinkChildFormProps {
  tenantId: string;
  parentMemberId: string;
  candidates: Array<{ id: string; full_name: string }>;
}

export function LinkChildForm({
  tenantId,
  parentMemberId,
  candidates,
}: LinkChildFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [childId, setChildId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (!childId) return;
    setErr(null);
    startTransition(async () => {
      const res = await linkParentChild({
        tenant_id: tenantId,
        parent_member_id: parentMemberId,
        child_member_id: childId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setChildId("");
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2">
      {candidates.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Geen kandidaten beschikbaar. Maak eerst een kind-lid aan via het
          formulier op de Leden-pagina.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            disabled={pending}
            className={`${inputCls} flex-1`}
            style={inputStyle}
          >
            <option value="">— Kies kind om te koppelen —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !childId}
            className={btnCls}
            style={btnStyle}
          >
            <Link2 className="h-4 w-4" /> Koppelen
          </button>
        </div>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

// ── Generate minor-link code (parent → child via code) ────

export interface GenerateMinorCodeButtonProps {
  tenantId: string;
  parentMemberId: string;
  childMemberId: string;
  childName: string;
}

export function GenerateMinorCodeButton({
  tenantId,
  parentMemberId,
  childMemberId,
  childName,
}: GenerateMinorCodeButtonProps) {
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setErr(null);
    setCode(null);
    startTransition(async () => {
      const res = await generateMinorLinkCode({
        tenant_id: tenantId,
        parent_member_id: parentMemberId,
        child_member_id: childMemberId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setCode(res.data.invite_code);
    });
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignored
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-transparent px-2.5 text-xs font-medium"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
      >
        <KeyRound className="h-3.5 w-3.5" />
        {pending ? "Bezig…" : `Genereer koppelcode voor ${childName}`}
      </button>
      {code && (
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-xs"
          style={{
            backgroundColor: "var(--surface-soft)",
            color: "var(--text-primary)",
          }}
        >
          {code}
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Kopieer code"
          >
            <Copy className="h-3 w-3" /> {copied ? "Gekopieerd" : "Kopieer"}
          </button>
        </span>
      )}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

// ── Assign membership plan ────────────────────────────────

export interface AssignPlanFormProps {
  tenantId: string;
  memberId: string;
  plans: Array<{ id: string; name: string }>;
}

export function AssignPlanForm({ tenantId, memberId, plans }: AssignPlanFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [planId, setPlanId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (plans.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Geen actieve abonnementen. Maak er eerst een aan via Abonnementen.
      </p>
    );
  }

  function submit() {
    if (!planId) return;
    setErr(null);
    startTransition(async () => {
      const res = await assignMembershipPlan({
        tenant_id: tenantId,
        member_id: memberId,
        membership_plan_id: planId,
        start_date: start,
        end_date: end,
        status: "active",
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setPlanId("");
      setStart("");
      setEnd("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        Abonnement toewijzen
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          disabled={pending}
          className={`${inputCls} sm:col-span-2`}
          style={inputStyle}
        >
          <option value="">— Kies abonnement —</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          disabled={pending}
          className={inputCls}
          style={inputStyle}
          aria-label="Startdatum"
        />
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          disabled={pending}
          className={inputCls}
          style={inputStyle}
          aria-label="Einddatum"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !planId}
          className={btnCls}
          style={btnStyle}
        >
          <Plus className="h-4 w-4" /> Toewijzen
        </button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

// ── Log payment ───────────────────────────────────────────

export interface LogPaymentFormProps {
  tenantId: string;
  memberships: Array<{ id: string; label: string }>;
}

export function LogPaymentForm({ tenantId, memberships }: LogPaymentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mmId, setMmId] = useState(memberships[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"paid" | "due" | "overdue" | "waived">("paid");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (!mmId) return;
    setErr(null);
    startTransition(async () => {
      const res = await logMembershipPayment({
        tenant_id: tenantId,
        member_membership_id: mmId,
        amount: amount === "" ? null : Number(amount),
        status,
        paid_at: paidAt ? new Date(paidAt).toISOString() : null,
        note,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setAmount("");
      setNote("");
      setPaidAt("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        Betaling registreren
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        <select
          value={mmId}
          onChange={(e) => setMmId(e.target.value)}
          disabled={pending}
          className={`${inputCls} sm:col-span-2`}
          style={inputStyle}
        >
          {memberships.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          inputMode="decimal"
          placeholder="Bedrag €"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={pending}
          className={inputCls}
          style={inputStyle}
          aria-label="Bedrag"
        />
        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as "paid" | "due" | "overdue" | "waived")
          }
          disabled={pending}
          className={inputCls}
          style={inputStyle}
        >
          <option value="paid">Betaald</option>
          <option value="due">Openstaand</option>
          <option value="overdue">Achterstallig</option>
          <option value="waived">Kwijtgescholden</option>
        </select>
        <input
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          disabled={pending}
          className={inputCls}
          style={inputStyle}
          aria-label="Betaaldatum"
        />
        <input
          placeholder="Notitie (optioneel)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          className={`${inputCls} sm:col-span-3`}
          style={inputStyle}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !mmId}
          className={btnCls}
          style={btnStyle}
        >
          <Receipt className="h-4 w-4" /> Loggen
        </button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

// ── Convert registration → member (legacy placeholder removed) ──
// The real conversion lives on the registrations list page now.
