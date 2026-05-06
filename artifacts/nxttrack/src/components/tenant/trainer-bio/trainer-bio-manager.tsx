"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  upsertSection,
  upsertField,
  deleteSection,
  deleteField,
  reorderSections,
  reorderFields,
} from "@/lib/actions/tenant/trainer-bio";
import type {
  TrainerBioField,
  TrainerBioFieldType,
  TrainerBioSection,
} from "@/lib/db/trainer-bio";

const TYPE_LABEL: Record<TrainerBioFieldType, string> = {
  short_text: "Kort tekstveld",
  long_text: "Lang tekstveld",
  bullet_list: "Lijst (bulletpoints)",
  number: "Nummer",
  date: "Datum",
};

interface Props {
  tenantId: string;
  sections: TrainerBioSection[];
  fields: TrainerBioField[];
}

export function TrainerBioManager({ tenantId, sections, fields }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fieldsBySection = useMemo(() => {
    const m = new Map<string, TrainerBioField[]>();
    for (const f of fields) {
      const list = m.get(f.section_id) ?? [];
      list.push(f);
      m.set(f.section_id, list);
    }
    return m;
  }, [fields]);

  function run(p: Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await p;
      if (!r.ok) setError(r.error ?? "Onbekende fout");
      router.refresh();
    });
  }

  function addSection() {
    run(
      upsertSection({
        tenant_id: tenantId,
        label: "Nieuwe sectie",
        is_active: true,
      }),
    );
  }

  function moveSection(idx: number, delta: number) {
    const next = idx + delta;
    if (next < 0 || next >= sections.length) return;
    const ids = sections.map((s) => s.id);
    [ids[idx], ids[next]] = [ids[next], ids[idx]];
    run(reorderSections({ tenant_id: tenantId, ordered_ids: ids }));
  }

  function moveField(sectionId: string, idx: number, delta: number) {
    const list = fieldsBySection.get(sectionId) ?? [];
    const next = idx + delta;
    if (next < 0 || next >= list.length) return;
    const ids = list.map((f) => f.id);
    [ids[idx], ids[next]] = [ids[next], ids[idx]];
    run(
      reorderFields({
        tenant_id: tenantId,
        section_id: sectionId,
        ordered_ids: ids,
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Beheer secties en vragen voor het trainersbio formulier. Trainers
          vullen dit in via hun profiel.
        </p>
        <button
          type="button"
          onClick={addSection}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-3 w-3" /> Nieuwe sectie
        </button>
      </div>

      {error && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ color: "#dc2626", borderColor: "#fca5a5" }}>
          {error}
        </p>
      )}

      {sections.length === 0 ? (
        <p
          className="rounded-2xl border p-4 text-xs"
          style={{
            color: "var(--text-secondary)",
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--surface-main)",
          }}
        >
          Nog geen secties. Voeg er één toe om te starten.
        </p>
      ) : (
        sections.map((s, idx) => (
          <SectionCard
            key={s.id}
            tenantId={tenantId}
            section={s}
            fields={fieldsBySection.get(s.id) ?? []}
            isFirst={idx === 0}
            isLast={idx === sections.length - 1}
            onMoveUp={() => moveSection(idx, -1)}
            onMoveDown={() => moveSection(idx, 1)}
            onMoveFieldUp={(fIdx) => moveField(s.id, fIdx, -1)}
            onMoveFieldDown={(fIdx) => moveField(s.id, fIdx, 1)}
            run={run}
            pending={pending}
          />
        ))
      )}
    </div>
  );
}

interface SectionCardProps {
  tenantId: string;
  section: TrainerBioSection;
  fields: TrainerBioField[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveFieldUp: (idx: number) => void;
  onMoveFieldDown: (idx: number) => void;
  run: (p: Promise<{ ok: boolean; error?: string }>) => void;
  pending: boolean;
}

function SectionCard({
  tenantId,
  section,
  fields,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onMoveFieldUp,
  onMoveFieldDown,
  run,
  pending,
}: SectionCardProps) {
  const [label, setLabel] = useState(section.label);
  const [active, setActive] = useState(section.is_active);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<TrainerBioFieldType>("short_text");

  function saveSection() {
    run(
      upsertSection({
        tenant_id: tenantId,
        id: section.id,
        label,
        is_active: active,
      }),
    );
  }

  function removeSection() {
    if (
      !confirm(
        "Sectie verwijderen? Alle vragen en bijbehorende antwoorden gaan verloren.",
      )
    )
      return;
    run(deleteSection({ tenant_id: tenantId, id: section.id }));
  }

  function addField() {
    if (!newFieldLabel.trim()) return;
    run(
      upsertField({
        tenant_id: tenantId,
        section_id: section.id,
        label: newFieldLabel.trim(),
        field_type: newFieldType,
        is_active: true,
      }),
    );
    setNewFieldLabel("");
  }

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm font-semibold outline-none"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        />
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          title={active ? "Sectie staat aan" : "Sectie staat uit"}
        >
          {active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {active ? "Actief" : "Uit"}
        </button>
        <IconBtn label="Omhoog" disabled={isFirst} onClick={onMoveUp}>
          <ArrowUp className="h-3 w-3" />
        </IconBtn>
        <IconBtn label="Omlaag" disabled={isLast} onClick={onMoveDown}>
          <ArrowDown className="h-3 w-3" />
        </IconBtn>
        <button
          type="button"
          onClick={saveSection}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Save className="h-3 w-3" /> Opslaan
        </button>
        <IconBtn label="Verwijder" onClick={removeSection}>
          <Trash2 className="h-3 w-3" style={{ color: "#dc2626" }} />
        </IconBtn>
      </div>

      <ul className="space-y-2">
        {fields.length === 0 && (
          <li className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen vragen in deze sectie.
          </li>
        )}
        {fields.map((f, i) => (
          <FieldRow
            key={f.id}
            tenantId={tenantId}
            field={f}
            isFirst={i === 0}
            isLast={i === fields.length - 1}
            onMoveUp={() => onMoveFieldUp(i)}
            onMoveDown={() => onMoveFieldDown(i)}
            run={run}
            pending={pending}
          />
        ))}
      </ul>

      <div
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <input
          value={newFieldLabel}
          onChange={(e) => setNewFieldLabel(e.target.value)}
          placeholder="Nieuwe vraag toevoegen…"
          className="flex-1 min-w-[180px] rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        />
        <select
          value={newFieldType}
          onChange={(e) => setNewFieldType(e.target.value as TrainerBioFieldType)}
          className="rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        >
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addField}
          disabled={pending || !newFieldLabel.trim()}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-3 w-3" /> Toevoegen
        </button>
      </div>
    </section>
  );
}

interface FieldRowProps {
  tenantId: string;
  field: TrainerBioField;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  run: (p: Promise<{ ok: boolean; error?: string }>) => void;
  pending: boolean;
}

function FieldRow({
  tenantId,
  field,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  run,
  pending,
}: FieldRowProps) {
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState<TrainerBioFieldType>(field.field_type);
  const [active, setActive] = useState(field.is_active);

  function save() {
    run(
      upsertField({
        tenant_id: tenantId,
        section_id: field.section_id,
        id: field.id,
        label,
        field_type: type,
        is_active: active,
      }),
    );
  }

  function remove() {
    if (!confirm("Vraag verwijderen? Antwoorden gaan verloren.")) return;
    run(deleteField({ tenant_id: tenantId, id: field.id }));
  }

  return (
    <li
      className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
      }}
    >
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 min-w-[160px] rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as TrainerBioFieldType)}
        className="rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
      >
        {Object.entries(TYPE_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setActive((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
      >
        {active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        {active ? "Actief" : "Uit"}
      </button>
      <IconBtn label="Omhoog" disabled={isFirst} onClick={onMoveUp}>
        <ArrowUp className="h-3 w-3" />
      </IconBtn>
      <IconBtn label="Omlaag" disabled={isLast} onClick={onMoveDown}>
        <ArrowDown className="h-3 w-3" />
      </IconBtn>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        <Save className="h-3 w-3" /> Opslaan
      </button>
      <IconBtn label="Verwijder" onClick={remove}>
        <Trash2 className="h-3 w-3" style={{ color: "#dc2626" }} />
      </IconBtn>
    </li>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border disabled:opacity-40"
      style={{
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
      }}
    >
      {children}
    </button>
  );
}
