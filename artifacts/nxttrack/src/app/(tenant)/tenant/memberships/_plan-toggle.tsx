"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMembershipPlanActive } from "@/lib/actions/tenant/members";

export interface PlanToggleProps {
  tenantId: string;
  id: string;
  isActive: boolean;
}

export function PlanToggle({ tenantId, id, isActive }: PlanToggleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await setMembershipPlanActive({
        tenant_id: tenantId,
        id,
        is_active: !isActive,
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium uppercase tracking-wide disabled:opacity-50"
      style={{
        backgroundColor: isActive ? "var(--accent)" : "var(--surface-soft)",
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
      }}
      aria-pressed={isActive}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: isActive ? "#10b981" : "#a1a1aa" }}
      />
      {isActive ? "Actief" : "Inactief"}
    </button>
  );
}
