"use client";

import { useTransition } from "react";
import { Power } from "lucide-react";
import { setTenantStatus } from "@/lib/actions/platform/tenants";

export function TenantStatusToggle({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const next = status === "active" ? "inactive" : "active";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setTenantStatus(id, next as "active" | "inactive");
        })
      }
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-50"
      style={{ color: "var(--text-secondary)" }}
      aria-label={status === "active" ? "Deactivate tenant" : "Activate tenant"}
    >
      <Power className="h-3.5 w-3.5" />
      {pending ? "..." : status === "active" ? "Deactivate" : "Activate"}
    </button>
  );
}
