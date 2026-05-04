"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Copy } from "lucide-react";
import { resendInvite, revokeInvite } from "@/lib/actions/tenant/invites";

export interface InviteRowActionsProps {
  tenantId: string;
  inviteId: string;
  status: string;
  inviteCode: string;
  acceptUrl: string;
}

export function InviteRowActions({
  tenantId,
  inviteId,
  status,
  inviteCode,
  acceptUrl,
}: InviteRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isClosed = status === "accepted" || status === "revoked";

  function doResend() {
    setErr(null);
    setInfo(null);
    startTransition(async () => {
      const res = await resendInvite({
        tenant_id: tenantId,
        invite_id: inviteId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setInfo("Opnieuw verstuurd.");
      router.refresh();
    });
  }

  function doRevoke() {
    if (!confirm("Uitnodiging intrekken?")) return;
    setErr(null);
    setInfo(null);
    startTransition(async () => {
      const res = await revokeInvite({
        tenant_id: tenantId,
        invite_id: inviteId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setInfo("Link gekopieerd.");
    } catch {
      setErr("Kon link niet kopiëren.");
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInfo("Code gekopieerd.");
    } catch {
      setErr("Kon code niet kopiëren.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-transparent px-2 text-[11px]"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
        >
          <Copy className="h-3 w-3" /> Code
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-transparent px-2 text-[11px]"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
        >
          <Copy className="h-3 w-3" /> Link
        </button>
        {!isClosed && (
          <button
            type="button"
            onClick={doResend}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Send className="h-3 w-3" /> Opnieuw
          </button>
        )}
        {!isClosed && (
          <button
            type="button"
            onClick={doRevoke}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1 rounded-md border bg-transparent px-2 text-[11px] disabled:opacity-50"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          >
            <X className="h-3 w-3" /> Intrekken
          </button>
        )}
      </div>
      {info && (
        <span className="text-[10px]" style={{ color: "var(--tenant-accent)" }}>
          {info}
        </span>
      )}
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </div>
  );
}
