"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import {
  setAttendanceAsTrainer,
  markAllPresentAsTrainer,
} from "@/lib/actions/public/training-trainer";
import {
  ABSENCE_REASONS,
  type NoteVisibility,
} from "@/lib/validation/trainings";

interface Row {
  id: string;
  memberId: string;
  memberName: string;
  currentMark: string | null;
  currentRsvp: string | null;
  currentNote: string;
  currentNoteVisibility: NoteVisibility;
  currentAbsenceReason: string | null;
  rsvpReasonText: string | null;
}

const REASON_LABEL: Record<string, string> = {
  ziekte: "Ziekte",
  blessure: "Blessure",
  school: "School",
  werk: "Werk",
  vakantie: "Vakantie",
  geen_vervoer: "Geen vervoer",
  overig: "Overig",
};

const RSVP_LABEL: Record<string, string> = {
  attending: "Aanwezig",
  not_attending: "Afwezig",
  maybe: "Misschien",
};

const QUICK_MARKS: Array<{ value: "present" | "absent" | "late" | "injured"; label: string }> = [
  { value: "present", label: "Aanwezig" },
  { value: "absent", label: "Afwezig" },
  { value: "late", label: "Te laat" },
  { value: "injured", label: "Geblesseerd" },
];

interface Props {
  tenantId: string;
  tenantSlug: string;
  sessionId: string;
  rows: Row[];
}

export function TrainerManageClient({
  tenantId,
  tenantSlug,
  sessionId,
  rows: initialRows,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pending, startTransition] = useTransition();
  const [bulkPending, startBulkTransition] = useTransition();
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function applyOptimistic(memberId: string, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.memberId === memberId ? { ...row, ...patch } : row)));
  }

  function quickMark(row: Row, mark: Row["currentMark"]) {
    setErr(null);
    applyOptimistic(row.memberId, { currentMark: mark });
    startTransition(async () => {
      const res = await setAttendanceAsTrainer({
        tenant_id: tenantId,
        session_id: sessionId,
        member_id: row.memberId,
        attendance: mark as "present",
        note: row.currentNote,
        note_visibility: row.currentNoteVisibility,
        absence_reason:
          mark === "absent" && row.currentAbsenceReason
            ? (row.currentAbsenceReason as "ziekte")
            : null,
      });
      if (!res.ok) {
        setErr(res.error);
        applyOptimistic(row.memberId, { currentMark: row.currentMark });
      }
    });
  }

  function markAllPresent() {
    setErr(null);
    startBulkTransition(async () => {
      const res = await markAllPresentAsTrainer({
        tenant_id: tenantId,
        session_id: sessionId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setRows((r) =>
        r.map((row) =>
          row.currentMark ? row : { ...row, currentMark: "present" as const },
        ),
      );
      router.refresh();
    });
  }

  const open = openMemberId ? rows.find((r) => r.memberId === openMemberId) ?? null : null;

  return (
    <>
      <div
        className="sticky top-14 z-10 -mx-3 flex flex-wrap items-center gap-2 border-b px-3 py-2"
        style={{
          backgroundColor: "var(--surface-base)",
          borderColor: "var(--surface-border)",
        }}
      >
        <button
          type="button"
          onClick={markAllPresent}
          disabled={bulkPending || pending}
          className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
        >
          Markeer alle aanwezig
        </button>
        <span
          className="text-[11px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {rows.filter((r) => r.currentMark).length}/{rows.length} gemarkeerd
        </span>
        {err && <span className="ml-auto text-[11px] text-red-600">{err}</span>}
      </div>

      <ul className="grid gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-2xl border"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div className="flex items-center gap-2 px-3 pt-3">
              <Link
                href={`/t/${tenantSlug}/members/${row.memberId}?from=session:${sessionId}`}
                className="min-w-0 flex-1"
              >
                <p
                  className="truncate text-sm font-semibold hover:underline"
                  style={{ color: "var(--text-primary)" }}
                >
                  {row.memberName}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Reactie: {row.currentRsvp ? RSVP_LABEL[row.currentRsvp] ?? row.currentRsvp : "geen"}
                  {row.rsvpReasonText && ` — "${row.rsvpReasonText}"`}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => setOpenMemberId(row.memberId)}
                className="rounded-full p-1.5"
                style={{ color: "var(--text-secondary)" }}
                aria-label="Meer opties"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-2">
              {QUICK_MARKS.map((m) => {
                const active = row.currentMark === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => quickMark(row, m.value)}
                    disabled={pending || bulkPending}
                    className="flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{
                      borderColor: "var(--surface-border)",
                      backgroundColor: active ? "var(--accent)" : "transparent",
                      color: "var(--text-primary)",
                      minWidth: "70px",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            {row.currentNote && (
              <p
                className="mx-3 mb-3 rounded-lg border px-2 py-1 text-[11px]"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-secondary)",
                }}
              >
                {row.currentNoteVisibility === "private" ? "Privé" : "Lid"}: {row.currentNote}
              </p>
            )}
          </li>
        ))}
      </ul>

      {open && (
        <DetailSheet
          row={open}
          pending={pending}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          sessionId={sessionId}
          onClose={() => setOpenMemberId(null)}
          onApply={(patch) => {
            applyOptimistic(open.memberId, patch);
            startTransition(async () => {
              const merged = { ...open, ...patch };
              const res = await setAttendanceAsTrainer({
                tenant_id: tenantId,
                session_id: sessionId,
                member_id: open.memberId,
                attendance: (merged.currentMark ?? "present") as "present",
                note: merged.currentNote,
                note_visibility: merged.currentNoteVisibility,
                absence_reason:
                  merged.currentMark === "absent" && merged.currentAbsenceReason
                    ? (merged.currentAbsenceReason as "ziekte")
                    : null,
              });
              if (!res.ok) {
                setErr(res.error);
                applyOptimistic(open.memberId, {
                  currentMark: open.currentMark,
                  currentNote: open.currentNote,
                  currentNoteVisibility: open.currentNoteVisibility,
                  currentAbsenceReason: open.currentAbsenceReason,
                });
              }
            });
          }}
        />
      )}
    </>
  );
}

interface DetailSheetProps {
  row: Row;
  pending: boolean;
  tenantId: string;
  tenantSlug: string;
  sessionId: string;
  onClose: () => void;
  onApply: (patch: Partial<Row>) => void;
}

function DetailSheet({ row, pending, tenantSlug, sessionId, onClose, onApply }: DetailSheetProps) {
  const [mark, setMark] = useState<string | null>(row.currentMark);
  const [note, setNote] = useState(row.currentNote);
  const [vis, setVis] = useState<NoteVisibility>(row.currentNoteVisibility);
  const [reason, setReason] = useState<string>(row.currentAbsenceReason ?? "");

  function save() {
    onApply({
      currentMark: mark,
      currentNote: note,
      currentNoteVisibility: vis,
      currentAbsenceReason: reason || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
      <div
        className="w-full max-w-md rounded-t-2xl border-t p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {row.memberName}
          </h3>
          <button type="button" onClick={onClose} aria-label="Sluiten">
            <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {QUICK_MARKS.map((m) => {
            const active = mark === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMark(m.value)}
                className="rounded-lg border px-2 py-2 text-xs font-semibold"
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

        {mark === "absent" && (
          <div className="mt-3">
            <label className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Reden
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
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

        <div className="mt-3">
          <label className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Notitie
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
          <div className="mt-2 flex gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setVis("private")}
              className="flex-1 rounded-md border px-2 py-1.5"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: vis === "private" ? "var(--accent)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              Privé (trainers)
            </button>
            <button
              type="button"
              onClick={() => setVis("member")}
              className="flex-1 rounded-md border px-2 py-1.5"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: vis === "member" ? "var(--accent)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              Zichtbaar voor lid
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            href={`/t/${tenantSlug}/members/${row.memberId}?from=session:${sessionId}`}
            className="flex-1 rounded-lg border px-3 py-2 text-center text-xs font-semibold"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            Open dossier
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-primary)",
            }}
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
