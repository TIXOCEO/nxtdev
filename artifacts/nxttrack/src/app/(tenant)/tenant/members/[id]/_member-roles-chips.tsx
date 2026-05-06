"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addMemberRole, removeMemberRole } from "@/lib/actions/tenant/members";
import { useToast } from "@/hooks/use-toast";

const ALL_ROLES = ["parent", "athlete", "trainer", "staff", "volunteer"] as const;
type RoleKey = (typeof ALL_ROLES)[number];

const ROLE_LABEL: Record<RoleKey, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

export interface MemberRolesChipsProps {
  tenantId: string;
  memberId: string;
  initialRoles: RoleKey[];
  /** Disable buttons when current user lacks edit-permissions. */
  readOnly?: boolean;
}

export function MemberRolesChips({
  tenantId,
  memberId,
  initialRoles,
  readOnly = false,
}: MemberRolesChipsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [roles, setRoles] = useState<RoleKey[]>(
    Array.from(new Set(initialRoles.filter((r) => ALL_ROLES.includes(r)))),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const remaining: RoleKey[] = ALL_ROLES.filter((r) => !roles.includes(r));

  function add(role: RoleKey) {
    if (readOnly) return;
    setPickerOpen(false);
    start(async () => {
      const res = await addMemberRole({
        tenant_id: tenantId,
        member_id: memberId,
        role,
      });
      if (!res.ok) {
        toast({ title: "Kon rol niet toevoegen", description: res.error });
        return;
      }
      setRoles((prev) => Array.from(new Set([...prev, role])));
      toast({ title: `Rol toegevoegd: ${ROLE_LABEL[role]}` });
      router.refresh();
    });
  }

  function remove(role: RoleKey) {
    if (readOnly) return;
    if (roles.length <= 1) {
      toast({
        title: "Minstens één rol vereist",
        description: "Voeg eerst een andere rol toe voordat je deze verwijdert.",
      });
      return;
    }
    start(async () => {
      const res = await removeMemberRole({
        tenant_id: tenantId,
        member_id: memberId,
        role,
      });
      if (!res.ok) {
        toast({ title: "Kon rol niet verwijderen", description: res.error });
        return;
      }
      setRoles((prev) => prev.filter((r) => r !== role));
      toast({ title: `Rol verwijderd: ${ROLE_LABEL[role]}` });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {roles.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Geen rollen toegewezen.
        </p>
      ) : (
        roles.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-primary)",
              border: "1px solid var(--surface-border)",
            }}
          >
            {ROLE_LABEL[r]}
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(r)}
                disabled={pending || roles.length <= 1}
                aria-label={`Verwijder rol ${ROLE_LABEL[r]}`}
                className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))
      )}

      {!readOnly && remaining.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-50"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
          >
            <Plus className="h-3 w-3" />
            Rol toevoegen
          </button>
          {pickerOpen && (
            <div
              className="absolute left-0 z-30 mt-1 min-w-40 rounded-xl border p-1 shadow-lg"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              {remaining.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => add(r)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-black/5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
