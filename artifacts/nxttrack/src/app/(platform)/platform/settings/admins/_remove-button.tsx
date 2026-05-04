"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { removePlatformAdmin } from "@/lib/actions/platform/admins";

interface Props {
  membershipId: string;
  label: string;
  disabled?: boolean;
}

export function RemoveAdminButton({ membershipId, label, disabled }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    if (
      !window.confirm(
        `Weet je zeker dat je "${label}" wilt verwijderen als platformbeheerder?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await removePlatformAdmin({ membership_id: membershipId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        title={
          disabled
            ? "Je kunt jezelf niet verwijderen."
            : "Verwijder als platformbeheerder"
        }
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: "var(--surface-border)",
          color: "#b91c1c",
        }}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
      {error && (
        <p className="text-[11px]" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}
    </div>
  );
}
