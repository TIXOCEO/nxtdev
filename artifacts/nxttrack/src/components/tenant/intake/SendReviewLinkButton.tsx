"use client";

import { useState, useTransition } from "react";
import { sendIntakeReviewLink } from "@/lib/actions/tenant/intake-review-link";

/**
 * Task #145 — Knop "Stuur 3 voorstellen aan aanvrager".
 *
 * Render-locatie: rechterkolom van /tenant/intake/[id], net boven of onder
 * `PlacementSuggestionsPanel`. Werkt onafhankelijk van de publieke flag
 * `tenants.settings_json.public_intake_propose_slots` — de admin heeft
 * eigen autoriteit via `assertTenantAccess`.
 */

export interface SendReviewLinkButtonProps {
  submissionId: string;
  contactEmail: string | null;
  disabledReason?: string | null;
}

export function SendReviewLinkButton({
  submissionId,
  contactEmail,
  disabledReason,
}: SendReviewLinkButtonProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: "success"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);

  const noEmail = !contactEmail;
  const disabled = noEmail || Boolean(disabledReason);

  function handleClick() {
    if (disabled) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `3 voorstellen mailen naar ${contactEmail}? De aanvrager krijgt een link (7 dagen geldig) naar de "Kies je tijdsblok"-pagina.`,
      )
    ) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await sendIntakeReviewLink({ submissionId });
        if (res.ok) {
          setFeedback({ kind: "success", text: "Voorstellen-mail verstuurd." });
        } else {
          setFeedback({
            kind: "error",
            text: `Versturen mislukt: ${res.error ?? "onbekende fout"}`,
          });
        }
      } catch (err) {
        setFeedback({
          kind: "error",
          text: `Versturen mislukt: ${err instanceof Error ? err.message : "onbekende fout"}`,
        });
      }
    });
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div>
        <h2 className="text-base font-semibold">Voorstellen-mail</h2>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Stuur de aanvrager direct een mail met 3 voorstellen + deep-link
          naar de keuzepagina.
        </p>
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground, white)",
        }}
      >
        {pending ? "Bezig…" : "Stuur 3 voorstellen aan aanvrager"}
      </button>

      {noEmail && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Geen contact-e-mail bekend — vul eerst een adres in op de aanvraag.
        </p>
      )}
      {disabledReason && !noEmail && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {disabledReason}
        </p>
      )}
      {feedback && (
        <p
          className="text-xs"
          style={{
            color:
              feedback.kind === "success"
                ? "var(--success, #1f9d55)"
                : "var(--danger, #c0392b)",
          }}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
