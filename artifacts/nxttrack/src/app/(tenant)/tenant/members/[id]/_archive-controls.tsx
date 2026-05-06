"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { archiveMember, unarchiveMember, unlinkParentChild } from "@/lib/actions/tenant/members";

export function ArchiveButton({
  tenantId,
  memberId,
  archived,
}: {
  tenantId: string;
  memberId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null);
    if (
      !archived &&
      !confirm(
        "Lid archiveren? Het lid blijft in de database staan maar wordt verborgen uit de standaard ledenlijst.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = archived
        ? await unarchiveMember({ tenant_id: tenantId, id: memberId })
        : await archiveMember({ tenant_id: tenantId, id: memberId });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50"
        style={{
          borderColor: archived ? "transparent" : "var(--surface-border)",
          backgroundColor: archived ? "#b6d83b" : "transparent",
          color: archived ? "#111" : "var(--text-primary)",
        }}
      >
        {archived ? (
          <>
            <ArchiveRestore className="h-3.5 w-3.5" /> {pending ? "Bezig…" : "Heractiveer lid"}
          </>
        ) : (
          <>
            <Archive className="h-3.5 w-3.5" /> {pending ? "Bezig…" : "Archiveer lid"}
          </>
        )}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

export function UnlinkChildButton({
  tenantId,
  parentMemberId,
  childMemberId,
  childName,
}: {
  tenantId: string;
  parentMemberId: string;
  childMemberId: string;
  childName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run() {
    if (!confirm(`Koppeling met ${childName} verwijderen?`)) return;
    setErr(null);
    start(async () => {
      const res = await unlinkParentChild({
        tenant_id: tenantId,
        parent_member_id: parentMemberId,
        child_member_id: childMemberId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-50"
        style={{ color: "var(--text-secondary)" }}
      >
        {pending ? "Verwijderen…" : "Ontkoppel"}
      </button>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  );
}
