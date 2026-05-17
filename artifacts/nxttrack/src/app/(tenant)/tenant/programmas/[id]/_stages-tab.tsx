"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus, X } from "lucide-react";
import {
  createProgramStage,
  updateProgramStage,
  archiveProgramStage,
  setProgramUseStages,
} from "@/lib/actions/tenant/program-stages";

interface StageRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
}

export function StagesTab({
  tenantId,
  programId,
  useStages,
  stages,
}: {
  tenantId: string;
  programId: string;
  useStages: boolean;
  stages: StageRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#60a5fa");
  const [newSort, setNewSort] = useState<string>("0");
  const [newDesc, setNewDesc] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>("");
  const [editSort, setEditSort] = useState<string>("0");
  const [editDesc, setEditDesc] = useState("");

  function refresh() {
    router.refresh();
  }

  function onToggleUseStages(next: boolean) {
    setErr(null);
    startTransition(async () => {
      const res = await setProgramUseStages({
        tenant_id: tenantId,
        program_id: programId,
        use_stages: next,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      refresh();
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!newName.trim()) {
      setErr("Naam is verplicht.");
      return;
    }
    startTransition(async () => {
      const res = await createProgramStage({
        tenant_id: tenantId,
        program_id: programId,
        name: newName.trim(),
        description: newDesc.trim() || null,
        color: newColor || null,
        sort_order: Number(newSort) || 0,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setNewName("");
      setNewDesc("");
      setNewSort("0");
      refresh();
    });
  }

  function beginEdit(s: StageRow) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color ?? "");
    setEditSort(String(s.sort_order));
    setEditDesc(s.description ?? "");
    setErr(null);
  }

  function onSaveEdit(stageId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await updateProgramStage({
        tenant_id: tenantId,
        stage_id: stageId,
        name: editName.trim(),
        description: editDesc.trim() || null,
        color: editColor.trim() || null,
        sort_order: Number(editSort) || 0,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setEditingId(null);
      refresh();
    });
  }

  function onArchive(stageId: string, archived: boolean) {
    setErr(null);
    startTransition(async () => {
      const res = await archiveProgramStage({
        tenant_id: tenantId,
        stage_id: stageId,
        archived,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      refresh();
    });
  }

  const active = stages.filter((s) => s.archived_at == null);
  const archived = stages.filter((s) => s.archived_at != null);

  return (
    <div className="grid gap-4">
      <section
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useStages}
              onChange={(e) => onToggleUseStages(e.target.checked)}
              disabled={pending}
            />
            <span style={{ color: "var(--text-primary)" }}>
              Gebruik stages voor dit programma
            </span>
          </label>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Wanneer uit: plaatsings-suggesties slaan niveau-match over (level_match = 0).
          </span>
        </div>
      </section>

      <section
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Actieve stages ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen stages. Voeg er hieronder een toe.
          </p>
        ) : (
          <ul className="grid gap-2 text-xs">
            {active.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--surface-border)" }}
              >
                {editingId === s.id ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_120px_80px_auto]">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={64}
                      className="h-8 rounded-md border bg-transparent px-2 text-xs"
                      style={{ borderColor: "var(--surface-border)" }}
                      aria-label="Stagenaam"
                    />
                    <input
                      type="text"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      placeholder="#rrggbb"
                      className="h-8 rounded-md border bg-transparent px-2 text-xs"
                      style={{ borderColor: "var(--surface-border)" }}
                      aria-label="Kleur"
                    />
                    <input
                      type="number"
                      min={0}
                      value={editSort}
                      onChange={(e) => setEditSort(e.target.value)}
                      className="h-8 rounded-md border bg-transparent px-2 text-xs"
                      style={{ borderColor: "var(--surface-border)" }}
                      aria-label="Volgorde"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSaveEdit(s.id)}
                        disabled={pending}
                        className="rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                      >
                        Opslaan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={pending}
                        className="rounded-md border px-2 py-1 text-[11px]"
                        style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                      >
                        Annuleren
                      </button>
                    </div>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Beschrijving (optioneel)"
                      maxLength={500}
                      className="sm:col-span-4 h-16 rounded-md border bg-transparent px-2 py-1 text-xs"
                      style={{ borderColor: "var(--surface-border)" }}
                    />
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color ?? "var(--surface-soft)" }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {s.name}
                          </span>
                          <span style={{ color: "var(--text-secondary)" }}>
                            #{s.sort_order}
                          </span>
                        </div>
                        {s.description && (
                          <p className="mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {s.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => beginEdit(s)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                        style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                      >
                        <Pencil className="h-3 w-3" /> Wijzig
                      </button>
                      <button
                        type="button"
                        onClick={() => onArchive(s.id, true)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                        style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                      >
                        <Archive className="h-3 w-3" /> Archiveer
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Nieuwe stage
        </h2>
        <form onSubmit={onCreate} className="grid gap-2 sm:grid-cols-[1fr_120px_80px_auto]">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Naam (bv. Watergewenning)"
            maxLength={64}
            className="h-8 rounded-md border bg-transparent px-2 text-xs"
            style={{ borderColor: "var(--surface-border)" }}
            aria-label="Stagenaam"
          />
          <input
            type="text"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            placeholder="#rrggbb"
            className="h-8 rounded-md border bg-transparent px-2 text-xs"
            style={{ borderColor: "var(--surface-border)" }}
            aria-label="Kleur"
          />
          <input
            type="number"
            min={0}
            value={newSort}
            onChange={(e) => setNewSort(e.target.value)}
            className="h-8 rounded-md border bg-transparent px-2 text-xs"
            style={{ borderColor: "var(--surface-border)" }}
            aria-label="Volgorde"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-3 w-3" /> Toevoegen
          </button>
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Beschrijving (optioneel)"
            maxLength={500}
            className="sm:col-span-4 h-16 rounded-md border bg-transparent px-2 py-1 text-xs"
            style={{ borderColor: "var(--surface-border)" }}
          />
        </form>
      </section>

      {archived.length > 0 && (
        <section
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Gearchiveerd ({archived.length})
          </h2>
          <ul className="grid gap-1.5 text-xs">
            {archived.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--surface-border)", opacity: 0.7 }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: s.color ?? "var(--surface-soft)" }}
                  />
                  <span style={{ color: "var(--text-secondary)" }}>{s.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onArchive(s.id, false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                >
                  <ArchiveRestore className="h-3 w-3" /> Activeer
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {err && (
        <p className="text-xs text-red-600" role="alert">
          <X className="mr-1 inline h-3 w-3" />
          {err}
        </p>
      )}
    </div>
  );
}
