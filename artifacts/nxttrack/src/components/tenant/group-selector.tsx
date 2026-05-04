"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addMemberToGroup, removeMemberFromGroup } from "@/lib/actions/tenant/members";
import type { Group } from "@/types/database";

export interface GroupSelectorProps {
  tenantId: string;
  memberId: string;
  /** Groups the member is currently in. */
  currentGroups: Group[];
  /** All groups in this tenant (for the add picker). */
  allGroups: Group[];
}

export function GroupSelector({
  tenantId,
  memberId,
  currentGroups,
  allGroups,
}: GroupSelectorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerValue, setPickerValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentIds = new Set(currentGroups.map((g) => g.id));
  const available = allGroups.filter((g) => !currentIds.has(g.id));

  function handleAdd() {
    if (!pickerValue) return;
    setError(null);
    const groupId = pickerValue;
    startTransition(async () => {
      const res = await addMemberToGroup({
        tenant_id: tenantId,
        group_id: groupId,
        member_id: memberId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPickerValue("");
      router.refresh();
    });
  }

  function handleRemove(groupId: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeMemberFromGroup({
        tenant_id: tenantId,
        group_id: groupId,
        member_id: memberId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {currentGroups.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Geen groepen gekoppeld.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {currentGroups.map((g) => (
            <li
              key={g.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-main)",
              }}
            >
              {g.name}
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRemove(g.id)}
                aria-label={`Verwijder uit ${g.name}`}
                className="rounded-full p-0.5 hover:bg-black/5 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
            disabled={pending}
            className="h-9 flex-1 rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
          >
            <option value="">— Kies groep —</option>
            {available.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !pickerValue}
            onClick={handleAdd}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> Toevoegen
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
