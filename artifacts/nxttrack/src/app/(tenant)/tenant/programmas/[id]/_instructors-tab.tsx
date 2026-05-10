"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  addProgramInstructor,
  removeProgramInstructor,
  updateProgramInstructorAssignment,
} from "@/lib/actions/tenant/program-instructors";
import type {
  ProgramInstructorRow,
  AvailableTrainerRow,
} from "@/lib/db/program-planning";

interface Props {
  tenantId: string;
  programId: string;
  assigned: ProgramInstructorRow[];
  available: AvailableTrainerRow[];
  leadLabel: string;
}

export function InstructorsTab({
  tenantId,
  programId,
  assigned,
  available,
  leadLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickMember, setPickMember] = useState<string>(available[0]?.id ?? "");
  const [pickType, setPickType] = useState<"primary" | "assistant">("primary");
  const [err, setErr] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!pickMember) return;
    setErr(null);
    startTransition(async () => {
      const res = await addProgramInstructor({
        tenant_id: tenantId,
        program_id: programId,
        member_id: pickMember,
        assignment_type: pickType,
        sort_order: assigned.length,
      });
      if (!res.ok) { setErr(res.error); return; }
      refresh();
    });
  }

  function onRemove(member_id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await removeProgramInstructor({
        tenant_id: tenantId,
        program_id: programId,
        member_id,
      });
      if (!res.ok) { setErr(res.error); return; }
      refresh();
    });
  }

  function onChangeType(member_id: string, assignment_type: "primary" | "assistant") {
    setErr(null);
    startTransition(async () => {
      const res = await updateProgramInstructorAssignment({
        tenant_id: tenantId,
        program_id: programId,
        member_id,
        assignment_type,
      });
      if (!res.ok) { setErr(res.error); return; }
      refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Default-instructeurs ({assigned.length})
        </h2>
        <p className="mb-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Sessies binnen dit programma vallen op deze instructeurs terug zolang er geen expliciete sessie-instructeur of group-trainer is.
        </p>
        {assigned.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen instructeurs toegewezen aan dit programma.
          </p>
        ) : (
          <ul className="grid gap-1.5 text-xs">
            {assigned.map((a) => (
              <li
                key={a.member_id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <div className="min-w-0 truncate font-medium" style={{ color: "var(--text-primary)" }}>
                  {a.member_name}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={a.assignment_type}
                    onChange={(e) =>
                      onChangeType(a.member_id, e.target.value as "primary" | "assistant")
                    }
                    disabled={pending}
                    className="h-7 rounded-md border bg-transparent px-2 text-[11px]"
                    style={{
                      borderColor: "var(--surface-border)",
                      color: "var(--text-primary)",
                      backgroundColor: "var(--surface-main)",
                    }}
                  >
                    <option value="primary">{leadLabel}</option>
                    <option value="assistant">Assistent</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onRemove(a.member_id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-red-600 disabled:opacity-50"
                    style={{ borderColor: "var(--surface-border)" }}
                    aria-label={`Verwijder ${a.member_name}`}
                  >
                    <Trash2 className="h-3 w-3" /> Verwijderen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Instructeur toevoegen
        </h2>
        {available.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Alle trainers binnen deze tenant zijn al toegewezen aan dit programma.
          </p>
        ) : (
          <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <select
              value={pickMember}
              onChange={(e) => setPickMember(e.target.value)}
              className="h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-main)",
              }}
            >
              {available.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
            <select
              value={pickType}
              onChange={(e) => setPickType(e.target.value as "primary" | "assistant")}
              className="h-10 rounded-xl border bg-transparent px-3 text-sm outline-none"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-main)",
              }}
            >
              <option value="primary">{leadLabel}</option>
              <option value="assistant">Assistent</option>
            </select>
            <button
              type="submit"
              disabled={pending || !pickMember}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <Plus className="h-4 w-4" /> Toevoegen
            </button>
          </form>
        )}
        {err && <p className="mt-2 text-xs text-red-600" role="alert">{err}</p>}
      </section>
    </div>
  );
}
