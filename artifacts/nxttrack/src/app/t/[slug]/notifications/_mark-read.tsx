"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { markRecipientRead } from "@/lib/actions/public/notifications";

export function MarkReadButton({
  recipientId,
  slug,
}: {
  recipientId: string;
  slug: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await markRecipientRead({ recipient_id: recipientId, slug });
          router.refresh();
        })
      }
      disabled={pending}
      className="rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-50"
      style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
      aria-label="Markeer als gelezen"
    >
      <Check className="inline h-3 w-3" /> Gelezen
    </button>
  );
}
