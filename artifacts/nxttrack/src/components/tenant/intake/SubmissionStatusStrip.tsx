"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markSubmissionInReview,
  markSubmissionNeedsReview,
  markSubmissionWaitlisted,
  rejectSubmission,
} from "@/lib/actions/tenant/submission-status";

/**
 * Sprint 73 — Status-strip op de intake-detailpagina.
 *
 * Klikbare transitie-knoppen met confirm-dialog (Naar wachtlijst en
 * Afwijzen vragen een korte reden). `placed` wordt via het bestaande
 * `PlacementSuggestionsPanel` afgehandeld, en wordt hier alleen als
 * read-only badge getoond.
 */

interface Props {
  submissionId: string;
  currentStatus: string;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Ingediend",
  in_review: "In beoordeling",
  needs_review: "Vereist beoordeling",
  waitlisted: "Wachtlijst",
  placed: "Geplaatst",
  rejected: "Afgewezen",
  converted: "Omgezet",
};

const STATUS_COLOR: Record<string, string> = {
  submitted: "#3b82f6",
  in_review: "#0ea5e9",
  needs_review: "#f59e0b",
  waitlisted: "#a855f7",
  placed: "#10b981",
  rejected: "#ef4444",
  converted: "#6b7280",
};

type Action =
  | { type: "in_review" }
  | { type: "needs_review" }
  | { type: "waitlisted" }
  | { type: "rejected" };

function actionLabel(a: Action): string {
  switch (a.type) {
    case "in_review":
      return "Beoordeling starten";
    case "needs_review":
      return "Markeer als vereist beoordeling";
    case "waitlisted":
      return "Naar wachtlijst";
    case "rejected":
      return "Afwijzen";
  }
}

function requiresReason(a: Action): boolean {
  return a.type === "waitlisted" || a.type === "rejected";
}

export function SubmissionStatusStrip({ submissionId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [reason, setReason] = useState("");

  const isTerminal =
    currentStatus === "placed" ||
    currentStatus === "rejected" ||
    currentStatus === "converted";

  const allowed: Action[] = [];
  if (!isTerminal) {
    if (["submitted", "needs_review", "waitlisted"].includes(currentStatus)) {
      allowed.push({ type: "in_review" });
    }
    if (["submitted", "in_review", "waitlisted"].includes(currentStatus)) {
      allowed.push({ type: "needs_review" });
    }
    if (["submitted", "in_review", "needs_review"].includes(currentStatus)) {
      allowed.push({ type: "waitlisted" });
    }
    allowed.push({ type: "rejected" });
  }

  function runAction(a: Action, reasonText: string) {
    setErrorMsg(null);
    startTransition(async () => {
      const input = {
        submissionId,
        reason: reasonText.trim() === "" ? undefined : reasonText.trim(),
      };
      let res;
      if (a.type === "in_review") res = await markSubmissionInReview(input);
      else if (a.type === "needs_review")
        res = await markSubmissionNeedsReview(input);
      else if (a.type === "waitlisted")
        res = await markSubmissionWaitlisted(input);
      else res = await rejectSubmission(input);

      if (!res.ok) {
        setErrorMsg(res.error ?? "Onbekende fout.");
        return;
      }
      setConfirming(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: STATUS_COLOR[currentStatus] ?? "#9ca3af" }}
          />
          <span className="text-sm font-semibold">
            {STATUS_LABEL[currentStatus] ?? currentStatus}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          {allowed.map((a) => (
            <button
              key={a.type}
              type="button"
              disabled={pending}
              onClick={() => {
                if (requiresReason(a)) {
                  setConfirming(a);
                  setReason("");
                } else {
                  runAction(a, "");
                }
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor:
                  a.type === "rejected"
                    ? "var(--danger, #ef4444)"
                    : "var(--accent)",
                color: "var(--accent-foreground, white)",
                opacity: pending ? 0.6 : 1,
              }}
            >
              {actionLabel(a)}
            </button>
          ))}
        </div>
      </div>

      {errorMsg ? (
        <p className="mt-2 text-xs" style={{ color: "var(--danger, #c0392b)" }}>
          {errorMsg}
        </p>
      ) : null}

      {confirming ? (
        <div
          className="mt-3 rounded-md p-3"
          style={{ backgroundColor: "var(--bg-elevated, var(--surface))", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-medium">{actionLabel(confirming)}</p>
          <label className="mt-2 flex flex-col text-xs">
            <span style={{ color: "var(--text-secondary)" }}>
              Reden (optioneel)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 rounded-md border px-2 py-1 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(confirming, reason)}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor:
                  confirming.type === "rejected"
                    ? "var(--danger, #ef4444)"
                    : "var(--accent)",
                color: "var(--accent-foreground, white)",
              }}
            >
              Bevestigen
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirming(null);
                setReason("");
              }}
              className="rounded-md px-3 py-1.5 text-xs"
              style={{ border: "1px solid var(--border)" }}
            >
              Annuleren
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
