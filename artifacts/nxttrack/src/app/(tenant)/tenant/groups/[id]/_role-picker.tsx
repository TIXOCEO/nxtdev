"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addMemberToGroup } from "@/lib/actions/tenant/members";

export interface GroupRolePickerProps {
  tenantId: string;
  groupId: string;
  label: string;
  members: Array<{ id: string; full_name: string }>;
}

export function GroupRolePicker({
  tenantId,
  groupId,
  label,
  members,
}: GroupRolePickerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [memberId, setMemberId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (!memberId) return;
    setErr(null);
    startTransition(async () => {
      const res = await addMemberToGroup({
        tenant_id: tenantId,
        group_id: groupId,
        member_id: memberId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMemberId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          disabled={pending || members.length === 0}
          className="h-9 flex-1 rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50"
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
            backgroundColor: "var(--surface-main)",
          }}
        >
          <option value="">
            — {members.length === 0 ? "Geen kandidaten beschikbaar" : label} —
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !memberId}
          className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" /> Toevoegen
        </button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
