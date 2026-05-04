"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat } from "lucide-react";
import { convertRegistrationToMember } from "@/lib/actions/tenant/invites";

export interface ConvertRegistrationButtonProps {
  tenantId: string;
  registrationId: string;
  alreadyConverted: boolean;
}

export function ConvertRegistrationButton({
  tenantId,
  registrationId,
  alreadyConverted,
}: ConvertRegistrationButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sendInvite, setSendInvite] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setErr(null);
    startTransition(async () => {
      const res = await convertRegistrationToMember({
        tenant_id: tenantId,
        registration_id: registrationId,
        send_invite: sendInvite,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (alreadyConverted) {
    return (
      <span
        className="text-[11px]"
        style={{ color: "var(--text-secondary)" }}
      >
        Reeds omgezet naar lid.
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className="inline-flex items-center gap-1 text-[11px]"
        style={{ color: "var(--text-secondary)" }}
      >
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(e) => setSendInvite(e.target.checked)}
          disabled={pending}
        />
        Stuur uitnodiging
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending || done}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold disabled:opacity-50"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--text-primary)",
        }}
      >
        <Repeat className="h-3.5 w-3.5" />
        {pending ? "Bezig…" : done ? "Omgezet" : "Omzetten naar lid"}
      </button>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  );
}
