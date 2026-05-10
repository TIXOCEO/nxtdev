"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Star } from "lucide-react";
import {
  linkProgramMembershipPlan,
  unlinkProgramMembershipPlan,
  setProgramMembershipPlanDefault,
} from "@/lib/actions/tenant/program-membership-plans";
import type {
  ProgramMembershipPlanRow,
  AvailableMembershipPlanRow,
} from "@/lib/db/program-membership-plans";

interface Props {
  tenantId: string;
  programId: string;
  assigned: ProgramMembershipPlanRow[];
  available: AvailableMembershipPlanRow[];
}

function formatPrice(p: number | null, period: string | null) {
  if (p == null) return "Geen prijs";
  const fmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
  return `${fmt.format(p)}${period ? ` / ${period}` : ""}`;
}

export function MembershipPlansTab({ tenantId, programId, assigned, available }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickPlan, setPickPlan] = useState<string>(available[0]?.id ?? "");
  const [pickDefault, setPickDefault] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!pickPlan) return;
    setErr(null);
    startTransition(async () => {
      const res = await linkProgramMembershipPlan({
        tenant_id: tenantId,
        program_id: programId,
        membership_plan_id: pickPlan,
        is_default: pickDefault,
        sort_order: assigned.length,
      });
      if (!res.ok) { setErr(res.error); return; }
      setPickDefault(false);
      refresh();
    });
  }

  function onRemove(planId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await unlinkProgramMembershipPlan({
        tenant_id: tenantId,
        program_id: programId,
        membership_plan_id: planId,
      });
      if (!res.ok) { setErr(res.error); return; }
      refresh();
    });
  }

  function onSetDefault(planId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await setProgramMembershipPlanDefault({
        tenant_id: tenantId,
        program_id: programId,
        membership_plan_id: planId,
      });
      if (!res.ok) { setErr(res.error); return; }
      refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Gekoppelde lidmaatschapsplannen ({assigned.length})
        </h2>
        <p className="mb-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Gekoppelde plannen worden bij sessie-aanmaak getoond als suggestie en gebruikt in de publieke marketplace (komt in Sprint 63). Markeer maximaal één plan als standaard.
        </p>
        {assigned.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen plannen gekoppeld aan dit programma.
          </p>
        ) : (
          <ul className="grid gap-1.5 text-xs">
            {assigned.map((p) => (
              <li
                key={p.membership_plan_id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate font-medium" style={{ color: "var(--text-primary)" }}>
                    {p.plan_name}
                    {p.is_default && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                      >
                        <Star className="h-2.5 w-2.5" /> Standaard
                      </span>
                    )}
                    {!p.is_active && (
                      <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                        Inactief
                      </span>
                    )}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {formatPrice(p.price, p.billing_period)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {!p.is_default && (
                    <button
                      type="button"
                      onClick={() => onSetDefault(p.membership_plan_id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] disabled:opacity-50"
                      style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                    >
                      <Star className="h-3 w-3" /> Maak standaard
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(p.membership_plan_id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-red-600 disabled:opacity-50"
                    style={{ borderColor: "var(--surface-border)" }}
                    aria-label={`Ontkoppel ${p.plan_name}`}
                  >
                    <Trash2 className="h-3 w-3" /> Ontkoppelen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Plan koppelen
        </h2>
        {available.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Alle actieve lidmaatschapsplannen binnen deze tenant zijn al gekoppeld aan dit programma.
          </p>
        ) : (
          <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <select
              value={pickPlan}
              onChange={(e) => setPickPlan(e.target.value)}
              className="h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-main)",
              }}
            >
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatPrice(p.price, p.billing_period)}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={pickDefault}
                onChange={(e) => setPickDefault(e.target.checked)}
              />
              Standaard
            </label>
            <button
              type="submit"
              disabled={pending || !pickPlan}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <Plus className="h-4 w-4" /> Koppelen
            </button>
          </form>
        )}
        {err && <p className="mt-2 text-xs text-red-600" role="alert">{err}</p>}
      </section>
    </div>
  );
}
