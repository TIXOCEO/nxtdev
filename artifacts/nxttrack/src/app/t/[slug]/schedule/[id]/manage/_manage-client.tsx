"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, Save, X } from "lucide-react";
import {
  setAttendanceAsTrainer,
  markAllPresentAsTrainer,
} from "@/lib/actions/public/training-trainer";
import {
  ABSENCE_REASONS,
  type NoteVisibility,
  type SetAttendanceInput,
} from "@/lib/validation/trainings";
import {
  TrainerListItem,
  TrainerProgressBar,
  TrainerStatusPill,
  TrainerSurface,
  trainerMarkTone,
} from "@/components/public/trainer-shell-components";

type AttendanceMark = SetAttendanceInput["attendance"];

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

const QUICK_MARKS: Array<{ value: AttendanceMark; label: string }> = [
  { value: "present", label: "Aanwezig" },
  { value: "absent", label: "Afwezig" },
  { value: "late", label: "Te laat" },
  { value: "injured", label: "Blessure" },
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
  const markedCount = rows.filter((r) => r.currentMark).length;

  function applyOptimistic(memberId: string, patch: Partial<Row>) {
    setRows((r) =>
      r.map((row) => (row.memberId === memberId ? { ...row, ...patch } : row)),
    );
  }

  function saveAttendance(row: Row, patch: Partial<Row>, rollback?: Partial<Row>) {
    setErr(null);
    applyOptimistic(row.memberId, patch);
    startTransition(async () => {
      const merged = { ...row, ...patch };
      const mark = (merged.currentMark ?? "present") as AttendanceMark;
      const res = await setAttendanceAsTrainer({
        tenant_id: tenantId,
        session_id: sessionId,
        member_id: row.memberId,
        attendance: mark,
        note: merged.currentNote,
        note_visibility: merged.currentNoteVisibility,
        absence_reason:
          mark === "absent" && merged.currentAbsenceReason
            ? (merged.currentAbsenceReason as SetAttendanceInput["absence_reason"])
            : null,
      });
      if (!res.ok) {
        setErr(res.error);
        applyOptimistic(row.memberId, rollback ?? row);
      }
    });
  }

  function quickMark(row: Row, mark: AttendanceMark) {
    saveAttendance(row, { currentMark: mark }, { currentMark: row.currentMark });
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
          row.currentMark ? row : { ...row, currentMark: "present" },
        ),
      );
      router.refresh();
    });
  }

  const open = openMemberId
    ? rows.find((r) => r.memberId === openMemberId) ?? null
    : null;

  return (
    <>
      <TrainerSurface className="sticky top-20 z-10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TrainerProgressBar done={markedCount} total={rows.length} />
          <div className="flex flex-wrap items-center gap-2">
            {err && <TrainerStatusPill toneKey="danger">{err}</TrainerStatusPill>}
            <button
              type="button"
              onClick={markAllPresent}
              disabled={bulkPending || pending}
              className="nxt-focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={{
                backgroundColor: "var(--brand-navy)",
                color: "#ffffff",
              }}
            >
              Alles aanwezig
            </button>
          </div>
        </div>
      </TrainerSurface>

      <div className="grid gap-3">
        {rows.map((row) => {
          const markTone = trainerMarkTone(row.currentMark);
          return (
            <TrainerListItem
              key={row.id}
              title={row.memberName}
              meta={`Reactie: ${row.currentRsvp ? RSVP_LABEL[row.currentRsvp] ?? row.currentRsvp : "geen"}`}
              icon={FileText}
            >
              <div className="flex flex-wrap items-center gap-2">
                <TrainerStatusPill toneKey={markTone.toneKey} icon={markTone.icon}>
                  {markTone.label}
                </TrainerStatusPill>
                {row.rsvpReasonText && (
                  <TrainerStatusPill toneKey="info">{row.rsvpReasonText}</TrainerStatusPill>
                )}
                {row.currentNote && (
                  <TrainerStatusPill toneKey="neutral">
                    {row.currentNoteVisibility === "private" ? "Prive" : "Lid"} notitie
                  </TrainerStatusPill>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUICK_MARKS.map((m) => {
                  const active = row.currentMark === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => quickMark(row, m.value)}
                      disabled={pending || bulkPending}
                      className="nxt-focus-ring min-h-10 rounded-md border px-2 py-2 text-xs font-semibold disabled:opacity-50"
                      style={{
                        borderColor: active
                          ? "color-mix(in srgb, var(--tenant-accent) 54%, transparent)"
                          : "var(--shell-border)",
                        backgroundColor: active
                          ? "color-mix(in srgb, var(--tenant-accent) 18%, #ffffff)"
                          : "var(--shell-panel-muted)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/t/${tenantSlug}/members/${row.memberId}?from=session:${sessionId}`}
                  className="nxt-focus-ring inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold"
                  style={{
                    borderColor: "var(--shell-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  Dossier
                </Link>
                <button
                  type="button"
                  onClick={() => setOpenMemberId(row.memberId)}
                  className="nxt-focus-ring inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold"
                  style={{
                    borderColor: "var(--shell-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  Notitie <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </TrainerListItem>
          );
        })}
      </div>

      {open && (
        <DetailSheet
          row={open}
          pending={pending}
          tenantSlug={tenantSlug}
          sessionId={sessionId}
          onClose={() => setOpenMemberId(null)}
          onApply={(patch) => {
            saveAttendance(open, patch, {
              currentMark: open.currentMark,
              currentNote: open.currentNote,
              currentNoteVisibility: open.currentNoteVisibility,
              currentAbsenceReason: open.currentAbsenceReason,
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
  tenantSlug: string;
  sessionId: string;
  onClose: () => void;
  onApply: (patch: Partial<Row>) => void;
}

function DetailSheet({
  row,
  pending,
  tenantSlug,
  sessionId,
  onClose,
  onApply,
}: DetailSheetProps) {
  const [mark, setMark] = useState<AttendanceMark | null>(
    row.currentMark as AttendanceMark | null,
  );
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className="w-full max-w-lg rounded-t-lg border-t p-4 shadow-2xl sm:rounded-lg sm:border"
        style={{
          backgroundColor: "var(--shell-panel-strong)",
          borderColor: "var(--shell-border)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {row.memberName}
            </h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Aanwezigheid en notitie
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="nxt-focus-ring rounded-md p-2"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {QUICK_MARKS.map((m) => {
            const active = mark === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMark(m.value)}
                className="nxt-focus-ring min-h-11 rounded-md border px-2 py-2 text-xs font-semibold"
                style={{
                  borderColor: active
                    ? "color-mix(in srgb, var(--tenant-accent) 54%, transparent)"
                    : "var(--shell-border)",
                  backgroundColor: active
                    ? "color-mix(in srgb, var(--tenant-accent) 18%, #ffffff)"
                    : "var(--shell-panel-muted)",
                  color: "var(--text-primary)",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {mark === "absent" && (
          <div className="mt-4">
            <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Reden
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border bg-transparent px-3 text-sm"
              style={{
                borderColor: "var(--shell-border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">Kies reden</option>
              {ABSENCE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABEL[r] ?? r}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Notitie
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border bg-transparent p-3 text-sm"
            style={{
              borderColor: "var(--shell-border)",
              color: "var(--text-primary)",
            }}
          />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setVis("private")}
              className="nxt-focus-ring rounded-md border px-2 py-2 font-semibold"
              style={{
                borderColor: "var(--shell-border)",
                backgroundColor:
                  vis === "private"
                    ? "color-mix(in srgb, var(--tenant-accent) 18%, #ffffff)"
                    : "transparent",
                color: "var(--text-primary)",
              }}
            >
              Prive
            </button>
            <button
              type="button"
              onClick={() => setVis("member")}
              className="nxt-focus-ring rounded-md border px-2 py-2 font-semibold"
              style={{
                borderColor: "var(--shell-border)",
                backgroundColor:
                  vis === "member"
                    ? "color-mix(in srgb, var(--tenant-accent) 18%, #ffffff)"
                    : "transparent",
                color: "var(--text-primary)",
              }}
            >
              Zichtbaar voor lid
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`/t/${tenantSlug}/members/${row.memberId}?from=session:${sessionId}`}
            className="nxt-focus-ring rounded-md border px-3 py-2 text-center text-xs font-semibold"
            style={{
              borderColor: "var(--shell-border)",
              color: "var(--text-primary)",
            }}
          >
            Dossier
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="nxt-focus-ring inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{
              backgroundColor: "var(--brand-navy)",
              color: "#ffffff",
            }}
          >
            <Save className="h-3.5 w-3.5" /> Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
