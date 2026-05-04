"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { removeMemberFromGroup } from "@/lib/actions/tenant/members";

export interface GroupMemberRowProps {
  tenantId: string;
  groupId: string;
  memberId: string;
  name: string;
  status?: string | null;
}

export function GroupMemberRow({
  tenantId,
  groupId,
  memberId,
  name,
  status,
}: GroupMemberRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function remove() {
    if (!confirm(`${name} uit de groep verwijderen?`)) return;
    setErr(null);
    startTransition(async () => {
      const res = await removeMemberFromGroup({
        tenant_id: tenantId,
        group_id: groupId,
        member_id: memberId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {name}
        </p>
        {status && (
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {status}
          </p>
        )}
        {err && <p className="text-[11px] text-red-600">{err}</p>}
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50"
        style={{ color: "var(--text-secondary)" }}
        aria-label="Verwijderen"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
