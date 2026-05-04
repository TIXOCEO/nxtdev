"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMyRsvp } from "@/lib/actions/public/trainings";
import { ABSENCE_REASONS } from "@/lib/validation/trainings";

const OPTIONS = [
  { value: "attending", label: "Aanwezig" },
  { value: "maybe", label: "Misschien" },
  { value: "not_attending", label: "Afwezig" },
] as const;
type RsvpValue = (typeof OPTIONS)[number]["value"];

const REASON_LABEL: Record<string, string> = {
  ziekte: "Ziekte",
  blessure: "Blessure",
  school: "School",
  werk: "Werk",
  vakantie: "Vakantie",
  geen_vervoer: "Geen vervoer",
  overig: "Overig",
};

export interface RsvpRowProps {
  tenantId: string;
  sessionId: string;
  memberId: string;
  memberName: string;
  currentRsvp: string | null;
  currentReason: string | null;
  currentReasonText: string | null;
  disabled?: boolean;
  /** Sprint 13: read-only when minor athlete viewing own row. */
  readOnly?: boolean;
}

export function RsvpRow({
  tenantId,
  sessionId,
  memberId,
  memberName,
  currentRsvp,
  currentReason,
  currentReasonText,
  disabled,
  readOnly,
}: RsvpRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rsvp, setRsvp] = useState<RsvpValue | null>(currentRsvp as RsvpValue | null);
  const [reason, setReason] = useState<string>(currentReason ?? "");
  const [reasonText, setReasonText] = useState(currentReasonText ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState<RsvpValue | null>(null);

  function pick(value: RsvpValue, confirmLate = false) {
    if (readOnly) return;
    setErr(null);
    startTransition(async () => {
      const res = await setMyRsvp({
        tenant_id: tenantId,
        session_id: sessionId,
        member_id: memberId,
        rsvp: value,
        absence_reason:
          value === "not_attending" && reason
            ? (reason as "ziekte")
            : null,
        attendance_reason:
          value === "not_attending" && reason === "overig" ? reasonText : null,
        confirm_late: confirmLate,
      });
      if (!res.ok) {
        if (res.error === "late_required") {
          setNeedsConfirm(value);
          return;
        }
        setErr(res.error);
        return;
      }
      setRsvp(value);
      setNeedsConfirm(null);
      router.refresh();
    });
  }

  function commitReason() {
    if (rsvp === "not_attending") pick("not_attending");
  }

  return (
    <li
      className="rounded-2xl border p-3"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {memberName}
          {readOnly && (
            <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--text-secondary)" }}>
              (alleen-lezen)
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {OPTIONS.map((o) => {
            const active = rsvp === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                disabled={pending || disabled || readOnly}
                className="rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: active ? "var(--accent)" : "transparent",
                  color: "var(--text-primary)",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {rsvp === "not_attending" && !readOnly && (
        <div className="mt-2 flex flex-col gap-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={commitReason}
            disabled={pending || disabled}
            className="h-8 rounded-lg border bg-transparent px-2 text-xs"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">— kies reden —</option>
            {ABSENCE_REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r] ?? r}
              </option>
            ))}
          </select>
          {reason === "overig" && (
            <input
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              onBlur={commitReason}
              placeholder="Toelichting (optioneel)"
              disabled={pending || disabled}
              className="h-8 rounded-lg border bg-transparent px-2 text-xs"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          )}
        </div>
      )}

      {needsConfirm && (
        <div
          className="mt-2 rounded-lg border p-2 text-xs"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            Je wijzigt je reactie binnen de cutoff. Trainers worden op de hoogte gebracht. Doorgaan?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => pick(needsConfirm, true)}
              disabled={pending}
              className="rounded-lg px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              Bevestig
            </button>
            <button
              type="button"
              onClick={() => setNeedsConfirm(null)}
              className="rounded-lg border px-3 py-1 text-xs"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              Annuleer
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </li>
  );
}
