"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { seedDefaultEmailTemplates } from "@/lib/actions/tenant/email";

export interface SeedDefaultsButtonProps {
  tenantId: string;
}

export function SeedDefaultsButton({ tenantId }: SeedDefaultsButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await seedDefaultEmailTemplates({ tenant_id: tenantId });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg(
        res.data.inserted === 0
          ? "Alle standaard templates zijn al aanwezig."
          : `${res.data.inserted} templates toegevoegd.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold disabled:opacity-50"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--text-primary)",
        }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {pending ? "Bezig…" : "Standaard templates plaatsen"}
      </button>
      {msg && (
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
