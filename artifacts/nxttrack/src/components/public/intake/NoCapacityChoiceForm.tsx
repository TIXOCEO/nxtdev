"use client";

import { useState, useTransition } from "react";
import {
  confirmWaitlistChoice,
  cancelSubmissionChoice,
} from "@/lib/actions/public/propose-slot";

export function NoCapacityChoiceForm({
  reviewToken,
  tenantSlug,
}: {
  reviewToken: string;
  tenantSlug: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"waitlist" | "cancel" | null>(null);

  function pickWaitlist() {
    setError(null);
    startTransition(async () => {
      const res = await confirmWaitlistChoice({ reviewToken });
      if (res.ok) setDone("waitlist");
      else setError(res.error ?? "Er ging iets mis.");
    });
  }

  function pickCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelSubmissionChoice({ reviewToken });
      if (res.ok) setDone("cancel");
      else setError(res.error ?? "Er ging iets mis.");
    });
  }

  if (done === "waitlist") {
    return (
      <div
        className="rounded-2xl p-5"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Je staat op de wachtlijst
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          We laten het weten zodra er een plek vrijkomt. Je hoeft verder niets te doen.
        </p>
        <a
          href={`/t/${tenantSlug}`}
          className="mt-4 inline-block text-sm underline"
          style={{ color: "var(--text-primary)" }}
        >
          Terug naar de homepage
        </a>
      </div>
    );
  }

  if (done === "cancel") {
    return (
      <div
        className="rounded-2xl p-5"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Aanvraag geannuleerd
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Je aanvraag is ingetrokken. Je kunt op elk moment opnieuw aanmelden.
        </p>
        <a
          href={`/t/${tenantSlug}`}
          className="mt-4 inline-block text-sm underline"
          style={{ color: "var(--text-primary)" }}
        >
          Terug naar de homepage
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={pickWaitlist}
        disabled={pending}
        className="block w-full rounded-2xl p-4 text-left transition"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          opacity: pending ? 0.7 : 1,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        <div
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Ja, zet me op de wachtlijst
        </div>
        <div
          className="mt-1 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          We nemen contact op zodra er een plek vrijkomt.
        </div>
      </button>
      <button
        type="button"
        onClick={pickCancel}
        disabled={pending}
        className="block w-full rounded-2xl p-4 text-left transition"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          opacity: pending ? 0.7 : 1,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        <div
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Nee, annuleer mijn aanvraag
        </div>
        <div
          className="mt-1 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          Je kunt later opnieuw aanmelden.
        </div>
      </button>
      {error ? (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
