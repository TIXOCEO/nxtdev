"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAvailability, deleteUnavailability } from "@/lib/actions/tenant/instructors";

export function DeleteRowButton({
  tenantId,
  rowId,
  kind,
}: {
  tenantId: string;
  rowId: string;
  kind: "availability" | "unavailability";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Verwijderen?")) return;
    startTransition(async () => {
      const res = kind === "availability"
        ? await deleteAvailability(tenantId, rowId)
        : await deleteUnavailability(tenantId, rowId);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Verwijderen"
      className="rounded-md p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
