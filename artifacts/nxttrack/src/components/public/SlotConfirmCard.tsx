"use client";

import { useActionState } from "react";
import { submitSlotResponse } from "@/lib/actions/public/slot-response";
import type { SlotResponseResult } from "@/lib/intake/respond-slot-offer";
import { SlotResponseCard } from "@/components/public/SlotResponseCard";

/**
 * Sprint 74 — Bevestigings-knop voor /intake-slot/<token>/accept|decline.
 * Toont eerst een GET-pagina met details en een POST-knop; pas na klik
 * wordt de mutatie uitgevoerd. Voorkomt mutation-on-GET door e-mail-
 * scanners/prefetchers.
 */
export function SlotConfirmCard({
  token,
  decision,
  groupName,
  contactName,
  expiresAt,
}: {
  token: string;
  decision: "accept" | "decline";
  groupName?: string | null;
  contactName?: string | null;
  expiresAt?: string;
}) {
  const [state, formAction, pending] = useActionState<
    SlotResponseResult | null,
    FormData
  >(submitSlotResponse, null);

  if (state) {
    return <SlotResponseCard decision={decision} result={state} />;
  }

  const isAccept = decision === "accept";
  const title = isAccept ? "Bevestig je plek" : "Plek weigeren";
  const intro = isAccept
    ? "Klik op de knop om je plek te bevestigen."
    : "Klik op de knop om aan te geven dat je deze plek niet wilt.";
  const buttonLabel = isAccept ? "Ja, plek bevestigen" : "Ja, plek weigeren";
  const buttonBg = isAccept ? "#1f9d55" : "#b91c1c";

  let expiresLabel = "";
  if (expiresAt) {
    try {
      expiresLabel = new Date(expiresAt).toLocaleString("nl-NL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      expiresLabel = expiresAt;
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "#f6f7f9",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          backgroundColor: "white",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>{title}</h1>
        {contactName ? (
          <p style={{ marginTop: "12px", fontSize: "14px", color: "#444" }}>
            Hallo {contactName},
          </p>
        ) : null}
        <p style={{ marginTop: "12px", fontSize: "14px", color: "#444" }}>
          {intro}
        </p>
        {groupName ? (
          <p style={{ marginTop: "8px", fontSize: "13px", color: "#666" }}>
            Groep: <strong>{groupName}</strong>
          </p>
        ) : null}
        {expiresLabel ? (
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#666" }}>
            Geldig tot: <strong>{expiresLabel}</strong>
          </p>
        ) : null}
        <form action={formAction} style={{ marginTop: "20px" }}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="decision" value={decision} />
          <button
            type="submit"
            disabled={pending}
            style={{
              backgroundColor: buttonBg,
              color: "white",
              border: 0,
              borderRadius: "10px",
              padding: "12px 18px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.7 : 1,
              width: "100%",
            }}
          >
            {pending ? "Bezig..." : buttonLabel}
          </button>
        </form>
      </div>
    </main>
  );
}
