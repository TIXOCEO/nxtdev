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
    <li className="nxt-shell-card flex list-none flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {memberName}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Reactie: {currentRsvp ? RSVP_LABEL[currentRsvp] ?? currentRsvp : "geen"}
            {rsvpReasonText && ` - "${rsvpReasonText}"`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
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
                className="nxt-focus-ring min-h-9 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                style={{
                  borderColor: active
                    ? "color-mix(in srgb, var(--shell-info) 38%, transparent)"
                    : "var(--shell-border)",
                  backgroundColor: active
                    ? "color-mix(in srgb, var(--shell-info) 12%, var(--shell-panel-strong))"
                    : "var(--shell-panel-strong)",
                  color: active ? "var(--shell-info)" : "var(--text-primary)",
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
            className="h-10 flex-1 rounded-xl border px-3 text-xs outline-none transition"
            style={{
              borderColor: "var(--shell-border)",
              backgroundColor: "var(--shell-panel-strong)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">- kies -</option>
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
          className="text-[11px] sm:w-32 sm:pt-2.5"
          style={{ color: "var(--text-secondary)" }}
        >
          Notitie
        </label>
        <div className="flex flex-1 flex-col gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => commit()}
            placeholder="Notitie (zie onder voor zichtbaarheid)"
            disabled={pending}
            className="h-10 rounded-xl border px-3 text-xs outline-none transition"
            style={{
              borderColor: "var(--shell-border)",
              backgroundColor: "var(--shell-panel-strong)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {[
              { value: "private" as const, label: "Prive (trainers)" },
              { value: "member" as const, label: "Zichtbaar voor lid" },
            ].map((option) => {
              const active = visibility === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setVisibility(option.value);
                    commit();
                  }}
                  disabled={pending}
                  className="nxt-focus-ring rounded-xl border px-3 py-1.5 font-semibold transition"
                  style={{
                    borderColor: active
                      ? "color-mix(in srgb, var(--shell-info) 38%, transparent)"
                      : "var(--shell-border)",
                    backgroundColor: active
                      ? "color-mix(in srgb, var(--shell-info) 12%, var(--shell-panel-strong))"
                      : "var(--shell-panel-strong)",
                    color: active ? "var(--shell-info)" : "var(--text-primary)",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </li>
  );
}
