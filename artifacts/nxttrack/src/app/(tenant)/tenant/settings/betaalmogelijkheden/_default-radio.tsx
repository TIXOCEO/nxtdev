"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDefaultPaymentMethod } from "@/lib/actions/tenant/payments";

export function PaymentMethodDefaultRadio({
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
    if (isDefault) return;
    start(async () => {
      const res = await setDefaultPaymentMethod({
        tenant_id: tenantId,
        id,
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
      <input
        type="radio"
        name="default-payment-method"
        checked={isDefault}
        onChange={pick}
        disabled={disabled || pending}
        className="h-3.5 w-3.5"
        aria-label="Standaard betaalmethode"
      />
      <span style={{ color: isDefault ? "var(--text-primary)" : "var(--text-secondary)" }}>
        Standaard
      </span>
    </label>
  );
}
