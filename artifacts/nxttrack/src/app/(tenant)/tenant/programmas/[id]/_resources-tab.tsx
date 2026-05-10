"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  addProgramResource,
  removeProgramResource,
} from "@/lib/actions/tenant/program-resources";
import type {
  ProgramResourceRow,
  AvailableResourceRow,
} from "@/lib/db/program-planning";

interface Props {
  tenantId: string;
  programId: string;
  assigned: ProgramResourceRow[];
  available: AvailableResourceRow[];
}

export function ResourcesTab({ tenantId, programId, assigned, available }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickResource, setPickResource] = useState<string>(available[0]?.id ?? "");
  const [pickMaxParticipants, setPickMaxParticipants] = useState<string>("");
  const [pickNotes, setPickNotes] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!pickResource) return;
    setErr(null);
    startTransition(async () => {
      const res = await addProgramResource({
        tenant_id: tenantId,
        program_id: programId,
        resource_id: pickResource,
        max_participants: pickMaxParticipants === "" ? null : Number(pickMaxParticipants),
        notes: pickNotes,
        sort_order: assigned.length,
      });
      if (!res.ok) { setErr(res.error); return; }
      setPickMaxParticipants("");
      setPickNotes("");
      refresh();
    });
  }

  function onRemove(resource_id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await removeProgramResource({
        tenant_id: tenantId,
        program_id: programId,
        resource_id,
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
          Default-resources ({assigned.length})
        </h2>
        <p className="mb-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Bij het aanmaken van een sessie binnen dit programma worden deze resources automatisch op de sessie geplaatst, met dubbel-boeking-detectie via de bestaande exclusion-constraint.
        </p>
        {assigned.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen default-resources gekoppeld aan dit programma.
          </p>
        ) : (
          <ul className="grid gap-1.5 text-xs">
            {assigned.map((r) => (
              <li
                key={r.resource_id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
                    {r.resource_name}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {r.resource_kind ? `${r.resource_kind} · ` : ""}
                    {r.max_participants != null ? `max ${r.max_participants} deelnemers` : "geen max"}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(r.resource_id)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-red-600 disabled:opacity-50"
                  style={{ borderColor: "var(--surface-border)" }}
                  aria-label={`Verwijder ${r.resource_name}`}
                >
                  <Trash2 className="h-3 w-3" /> Verwijderen
                </button>
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
          Resource toevoegen
        </h2>
        {available.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Alle actieve resources binnen deze tenant zijn al gekoppeld aan dit programma.
          </p>
        ) : (
          <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-[1fr_auto_2fr_auto]">
            <select
              value={pickResource}
              onChange={(e) => setPickResource(e.target.value)}
              className="h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-main)",
              }}
            >
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.kind ? ` (${r.kind})` : ""}
                  {r.capacity != null ? ` · cap ${r.capacity}` : ""}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              placeholder="Max deelnemers"
              value={pickMaxParticipants}
              onChange={(e) => setPickMaxParticipants(e.target.value)}
              className="h-10 w-32 rounded-xl border bg-transparent px-3 text-sm outline-none"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-main)",
              }}
            />
            <input
              type="text"
              placeholder="Notities (optioneel)"
              value={pickNotes}
              onChange={(e) => setPickNotes(e.target.value)}
              maxLength={500}
              className="h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-main)",
              }}
            />
            <button
              type="submit"
              disabled={pending || !pickResource}
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
