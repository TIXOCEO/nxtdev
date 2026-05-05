"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  revealMemberIban,
  updateFinancialDetails,
} from "@/lib/actions/public/profile";
import { formatIbanGroups, ibanError, maskIban, normalizeIban } from "@/lib/iban";
import type { PaymentMethod } from "@/types/database";

export interface FinancialVM {
  has_iban: boolean;
  iban_masked: string | null;
  account_holder_name: string | null;
  payment_method_id: string | null;
}

export function FinancialTab({
  tenantId,
  memberId,
  initial,
  paymentMethods,
  canViewIban,
  canManageIban,
}: {
  tenantId: string;
  memberId: string;
  initial: FinancialVM | null;
  paymentMethods: PaymentMethod[];
  canViewIban: boolean;
  canManageIban: boolean;
}) {
  const [pending, start] = useTransition();
  const [revealing, startReveal] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [iban, setIban] = useState<string>("");
  const [holder, setHolder] = useState<string>(initial?.account_holder_name ?? "");
  const [methodId, setMethodId] = useState<string>(initial?.payment_method_id ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [maskedDisplay, setMaskedDisplay] = useState<string | null>(
    initial?.iban_masked ?? null,
  );

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  function reveal() {
    if (!canViewIban || revealed) return;
    setMsg(null);
    startReveal(async () => {
      const res = await revealMemberIban({ tenant_id: tenantId, member_id: memberId });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      const value = res.data.iban;
      if (!value) {
        setMsg({ kind: "err", text: "Geen IBAN opgeslagen." });
        return;
      }
      setRevealed(value);
      revealTimer.current = setTimeout(() => setRevealed(null), 30_000);
    });
  }

  function hide() {
    setRevealed(null);
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const fieldErr = ibanError(iban);
    if (fieldErr) {
      setMsg({ kind: "err", text: fieldErr });
      return;
    }

    start(async () => {
      const res = await updateFinancialDetails({
        tenant_id: tenantId,
        member_id: memberId,
        iban: iban,
        account_holder_name: holder,
        payment_method_id: methodId,
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Financiële gegevens opgeslagen." });
      setMaskedDisplay(res.data.iban_masked);
      setIban("");
      hide();
    });
  }

  const activeMask = revealed ? formatIbanGroups(revealed) : maskedDisplay;

  return (
    <form onSubmit={submit} className="space-y-4">
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Bankgegevens
        </h3>

        {activeMask && (
          <div
            className="mb-3 flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-mono"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-primary)",
            }}
          >
            <span aria-label={revealed ? "Volledig IBAN" : "Gemaskerd IBAN"}>{activeMask}</span>
            {canViewIban && (
              <button
                type="button"
                onClick={revealed ? hide : reveal}
                disabled={revealing}
                className="inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                style={{ color: "var(--tenant-accent)" }}
              >
                {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {revealed ? "Verberg" : revealing ? "Bezig…" : "Toon (30s)"}
              </button>
            )}
          </div>
        )}

        {canManageIban ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium sm:col-span-2" style={{ color: "var(--text-secondary)" }}>
              {activeMask ? "Vervang IBAN" : "IBAN"}
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase())}
                onBlur={() => setIban((v) => (v ? formatIbanGroups(normalizeIban(v)) : v))}
                placeholder="NL00 BANK 0123 4567 89"
                className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm font-mono uppercase outline-none"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--surface-soft)",
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <span className="mt-1 block text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Wordt versleuteld opgeslagen en gemaskerd weergegeven. Laat leeg om huidige IBAN te behouden.
              </span>
            </label>

            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Tenaamstelling
              <input
                type="text"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--surface-soft)",
                }}
              />
            </label>

            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Betaalmethode
              <select
                value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
                className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--surface-soft)",
                }}
              >
                <option value="">— Kies een methode —</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Je hebt geen rechten om bankgegevens te bewerken.
          </p>
        )}
      </section>

      {canManageIban && (
        <div className="flex items-center justify-end gap-3">
          {msg && (
            <span className={msg.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-red-600"}>
              {msg.text}
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#b6d83b", color: "#111" }}
          >
            {pending ? "Bezig…" : "Opslaan"}
          </button>
        </div>
      )}
      {!canManageIban && msg && (
        <p className={msg.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-red-600"}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
