"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDefaultMembershipPlan } from "@/lib/actions/tenant/payments";

export function PlanDefaultRadio({
  tenantId,
  id,
  isDefault,
  disabled,
}: {
  tenantId: string;
  id: string;
  isDefault: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick() {
    if (isDefault) return; // strict radio: kan niet uitgezet worden, enkel
    // door op een ander plan te klikken.
    start(async () => {
      const res = await setDefaultMembershipPlan({
        tenant_id: tenantId,
        id,
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide">
      <input
        type="radio"
        name="default-plan"
        checked={isDefault}
        onChange={pick}
        disabled={disabled || pending}
        className="h-3.5 w-3.5"
        aria-label="Standaard abonnement"
      />
      <span style={{ color: isDefault ? "var(--text-primary)" : "var(--text-secondary)" }}>
        Standaard
      </span>
    </label>
  );
}
