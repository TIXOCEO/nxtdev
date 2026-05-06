"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAttendance } from "@/lib/actions/tenant/trainings";
import { ABSENCE_REASONS, type NoteVisibility } from "@/lib/validation/trainings";

const MARKS = [
  { value: "present", label: "Aanwezig" },
  { value: "late", label: "Te laat" },
  { value: "absent", label: "Afwezig" },
  { value: "injured", label: "Geblesseerd" },
] as const;
type Mark = (typeof MARKS)[number]["value"];

const RSVP_LABEL: Record<string, string> = {
  attending: "Aanwezig",
  not_attending: "Afwezig",
  maybe: "Misschien",
};

const REASON_LABEL: Record<string, string> = {
  ziekte: "Ziekte",
  blessure: "Blessure",
  school: "School",
  werk: "Werk",
  vakantie: "Vakantie",
  geen_vervoer: "Geen vervoer",
  overig: "Overig",
};

export interface AttendanceMarkRowProps {
  tenantId: string;
  sessionId: string;
  memberId: string;
  memberName: string;
  currentRsvp: string | null;
  currentMark: string | null;
  currentNote: string;
  currentNoteVisibility: NoteVisibility;
  currentAbsenceReason: string | null;
  rsvpReasonText: string | null;
}

export function AttendanceMarkRow({
  tenantId,
  sessionId,
  memberId,
  memberName,
  currentRsvp,
  currentMark,
  currentNote,
  currentNoteVisibility,
  currentAbsenceReason,
  rsvpReasonText,
}: AttendanceMarkRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mark, setMark] = useState<Mark | null>(currentMark as Mark | null);
  const [note, setNote] = useState(currentNote);
  const [visibility, setVisibility] =
    useState<NoteVisibility>(currentNoteVisibility);
  const [absenceReason, setAbsenceReason] = useState<string>(currentAbsenceReason ?? "");
  const [err, setErr] = useState<string | null>(null);

  function commit(nextMark?: Mark) {
    const finalMark = (nextMark ?? mark) as Mark | null;
    if (!finalMark) return;
    setErr(null);
    startTransition(async () => {
      const res = await setAttendance({
        tenant_id: tenantId,
        session_id: sessionId,
        member_id: memberId,
        attendance: finalMark,
        note,
        note_visibility: visibility,
        absence_reason:
          finalMark === "absent" && absenceReason
            ? (absenceReason as "ziekte")
            : null,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {memberName}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Reactie: {currentRsvp ? RSVP_LABEL[currentRsvp] ?? currentRsvp : "geen"}
            {rsvpReasonText && ` — "${rsvpReasonText}"`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {MARKS.map((m) => {
            const active = mark === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setMark(m.value);
                  commit(m.value);
                }}
                disabled={pending}
                className="rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: active ? "var(--accent)" : "transparent",
                  color: "var(--text-primary)",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {mark === "absent" && (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <label
            className="text-[11px] sm:w-32"
            style={{ color: "var(--text-secondary)" }}
          >
            Reden afwezigheid
          </label>
          <select
            value={absenceReason}
            onChange={(e) => setAbsenceReason(e.target.value)}
            onBlur={() => commit()}
            disabled={pending}
            className="h-8 flex-1 rounded-lg border bg-transparent px-2 text-xs"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">— kies —</option>
            {ABSENCE_REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r] ?? r}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
        <label
          className="text-[11px] sm:w-32 sm:pt-1.5"
          style={{ color: "var(--text-secondary)" }}
        >
          Notitie
        </label>
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => commit()}
            placeholder="Notitie (zie onder voor zichtbaarheid)"
            disabled={pending}
            className="h-8 rounded-lg border bg-transparent px-2 text-xs"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setVisibility("private");
                commit();
              }}
              disabled={pending}
              className="rounded-md border px-2 py-0.5"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor:
                  visibility === "private" ? "var(--accent)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              Privé (trainers)
            </button>
            <button
              type="button"
              onClick={() => {
                setVisibility("member");
                commit();
              }}
              disabled={pending}
              className="rounded-md border px-2 py-0.5"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor:
                  visibility === "member" ? "var(--accent)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              Zichtbaar voor lid
            </button>
          </div>
        </div>
      </div>

      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </li>
  );
}
