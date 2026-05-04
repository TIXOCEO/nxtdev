"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleEmailTemplate } from "@/lib/actions/tenant/email";

export interface TemplateToggleProps {
  tenantId: string;
  id: string;
  isEnabled: boolean;
}

export function TemplateToggle({ tenantId, id, isEnabled }: TemplateToggleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function flip() {
    startTransition(async () => {
      const res = await toggleEmailTemplate({
        tenant_id: tenantId,
        id,
        is_enabled: !isEnabled,
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      aria-pressed={isEnabled}
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium uppercase tracking-wide disabled:opacity-50"
      style={{
        backgroundColor: isEnabled ? "var(--accent)" : "var(--surface-soft)",
        color: isEnabled ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: isEnabled ? "#10b981" : "#a1a1aa" }}
      />
      {isEnabled ? "Aan" : "Uit"}
    </button>
  );
}
