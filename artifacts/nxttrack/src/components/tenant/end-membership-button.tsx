"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, X } from "lucide-react";
import { endMemberMembership } from "@/lib/actions/tenant/payments";

export function EndMembershipButton({
  tenantId,
  memberMembershipId,
  disabled,
}: {
  tenantId: string;
  memberMembershipId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    start(async () => {
      const res = await endMemberMembership({
        tenant_id: tenantId,
        member_membership_id: memberMembershipId,
        end_date: endDate,
        end_reason: reason,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (disabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px]"
        style={{
          borderColor: "var(--surface-border)",
          color: "#b91c1c",
        }}
      >
        <CalendarOff className="h-3 w-3" /> Beëindig
      </button>

      {open && (
        <div className="mt-2 rounded-xl border p-3" style={{ borderColor: "var(--surface-border)" }}>
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Abonnement beëindigen
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <X className="h-3.5 w-3.5" /> Annuleer
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Einddatum *
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
                required
              />
            </label>
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Reden (optioneel)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
                placeholder="Bijv. 'Verhuisd'"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            {err && <span className="text-xs text-red-600">{err}</span>}
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold"
              style={{ backgroundColor: "#dc2626", color: "white" }}
            >
              {pending ? "Bezig…" : "Beëindig"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
