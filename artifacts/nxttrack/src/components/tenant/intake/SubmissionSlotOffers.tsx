"use client";

import { useState, useTransition } from "react";
import { cancelIntakeSlotOffer } from "@/lib/actions/tenant/slot-offers";

/**
 * Sprint 74 — Tijdlijn van slot-offers op submission-detail.
 * Toont alle aanbiedingen (pending/accepted/declined/expired/cancelled)
 * met groep-naam, vervalmoment en optioneel een "Annuleer"-knop op
 * pending-aanbiedingen.
 */

export interface SlotOfferRow {
  id: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  expires_at: string;
  used_at: string | null;
  created_at: string;
  group_name: string | null;
}

const STATUS_LABEL: Record<SlotOfferRow["status"], string> = {
  pending: "Verstuurd — wacht op reactie",
  accepted: "Geaccepteerd",
  declined: "Geweigerd",
  expired: "Verlopen",
  cancelled: "Geannuleerd",
};

const STATUS_COLOR: Record<SlotOfferRow["status"], string> = {
  pending: "#d68910",
  accepted: "#1f9d55",
  declined: "#c0392b",
  expired: "#888",
  cancelled: "#888",
};

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SubmissionSlotOffers({
  offers,
  canCancel,
}: {
  offers: SlotOfferRow[];
  canCancel: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (offers.length === 0) return null;

  function handleCancel(offerId: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Aanbod intrekken? De aanvrager kan dan niet meer accepteren.")
    ) {
      return;
    }
    setBusy(offerId);
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await cancelIntakeSlotOffer({ offerId });
        setFeedback(res.ok ? "Aanbod ingetrokken." : `Mislukt: ${res.error}`);
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-base font-semibold">Aangeboden plekken</h2>
      <ul className="mt-3 space-y-2">
        {offers.map((o) => {
          const isExpiredAt = new Date(o.expires_at).getTime() < Date.now();
          const showAsExpired = o.status === "pending" && isExpiredAt;
          const effectiveStatus: SlotOfferRow["status"] = showAsExpired ? "expired" : o.status;
          return (
            <li
              key={o.id}
              className="flex items-start justify-between gap-3 rounded-xl p-3 text-sm"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLOR[effectiveStatus] }}
                    aria-hidden
                  />
                  <span className="font-medium">{o.group_name ?? "—"}</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {STATUS_LABEL[effectiveStatus]}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Verstuurd: {fmt(o.created_at)} · Verloopt: {fmt(o.expires_at)}
                  {o.used_at ? ` · Reactie: ${fmt(o.used_at)}` : ""}
                </p>
              </div>
              {canCancel && o.status === "pending" && !showAsExpired ? (
                <button
                  type="button"
                  onClick={() => handleCancel(o.id)}
                  disabled={pending && busy === o.id}
                  className="rounded-md px-2 py-1 text-xs disabled:opacity-50"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {pending && busy === o.id ? "Bezig…" : "Intrekken"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {feedback ? (
        <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
