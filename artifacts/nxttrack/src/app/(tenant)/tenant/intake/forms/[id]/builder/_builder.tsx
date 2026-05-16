"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { IntakeFormFieldConfig, IntakeFieldType } from "@/lib/intake/types";
import { validateIntakeForm } from "@/lib/intake/validate-form";
import {
  addIntakeFormField,
  updateIntakeFormField,
  removeIntakeFormField,
  reorderIntakeFormFields,
  publishIntakeForm,
} from "@/lib/actions/tenant/intake-forms";
import { DynamicIntakeForm } from "@/components/public/forms/dynamic-intake-form";

type FieldWithId = IntakeFormFieldConfig & { id: string };

const FIELD_TYPES: { value: IntakeFieldType; label: string }[] = [
  { value: "text", label: "Tekst" },
  { value: "textarea", label: "Lang tekstveld" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefoon" },
  { value: "date", label: "Datum" },
  { value: "number", label: "Getal" },
  { value: "select", label: "Keuzelijst" },
  { value: "multiselect", label: "Meerkeuze-lijst" },
  { value: "radio", label: "Radio-groep" },
  { value: "checkbox", label: "Vinkje" },
  { value: "consent", label: "Akkoord (consent)" },
];

const CANONICAL_TARGETS: { value: string; label: string }[] = [
  { value: "", label: "— geen —" },
  { value: "contact_name", label: "contact_name" },
  { value: "contact_email", label: "contact_email" },
  { value: "contact_phone", label: "contact_phone" },
  { value: "contact_date_of_birth", label: "contact_date_of_birth" },
  { value: "registration_target", label: "registration_target" },
];

function uniqKey(existing: string[], base = "veld"): string {
  let i = 1;
  let cand = `${base}_${i}`;
  while (existing.includes(cand)) {
    i += 1;
    cand = `${base}_${i}`;
  }
  return cand;
}

function SortableRow({
  field,
  selected,
  onSelect,
  onRemove,
}: {
  field: FieldWithId;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md p-2"
      onClick={onSelect}
      data-selected={selected}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab select-none px-2 text-lg"
        title="Versleep"
      >
        ⋮⋮
      </span>
      <div className="flex-1 cursor-pointer">
        <p className="text-sm font-medium">
          {field.label}{" "}
          {field.is_required ? (
            <span className="text-red-600">*</span>
          ) : null}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          <code>{field.key}</code> · {field.field_type}
          {field.show_if?.field_key
            ? ` · toon als ${field.show_if.field_key}=${String(
                field.show_if.equals,
              )}`
            : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded px-2 py-1 text-xs"
        style={{ color: "#dc2626" }}
      >
        Verwijder
      </button>
    </li>
  );
}

export function IntakeFormBuilder({
  tenantId,
  formId,
  initialFields,
  formStatus = "draft",
}: {
  tenantId: string;
  formId: string;
  initialFields: FieldWithId[];
  formStatus?: "draft" | "published" | "archived";
}) {
  const [fields, setFields] = useState<FieldWithId[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialFields[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor));

  const validation = useMemo(() => validateIntakeForm(fields), [fields]);
  const previewConfig = useMemo(
    () => ({
      id: formId,
      slug: "preview",
      name: "Preview",
      status: "draft" as const,
      is_default: false,
      submission_type: "trial_lesson" as const,
      updated_at: new Date().toISOString(),
      source: "db" as const,
      fields: fields.map((f) => ({ ...f })),
    }),
    [fields, formId],
  );

  const selected = fields.find((f) => f.id === selectedId) ?? null;

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex((f) => f.id === active.id);
    const newIdx = fields.findIndex((f) => f.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(fields, oldIdx, newIdx);
    setFields(next);
    startTransition(async () => {
      const res = await reorderIntakeFormFields({
        tenant_id: tenantId,
        form_id: formId,
        ordered_field_ids: next.map((f) => f.id),
      });
      if (!res.ok) {
        setError(res.error);
        setFields(fields);
      }
    });
  }

  function addField() {
    setError(null);
    const usedKeys = fields.map((f) => f.key);
    const key = uniqKey(usedKeys);
    const sortOrder = (fields.length + 1) * 10;
    startTransition(async () => {
      const res = await addIntakeFormField({
        tenant_id: tenantId,
        form_id: formId,
        field: {
          key,
          label: "Nieuw veld",
          field_type: "text",
          is_required: false,
          sort_order: sortOrder,
          pii_class: "standard",
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const newF: FieldWithId = {
        id: res.data.field_id,
        key,
        label: "Nieuw veld",
        field_type: "text",
        is_required: false,
        sort_order: sortOrder,
        pii_class: "standard",
        options: [],
        validation: {},
        show_if: null,
        canonical_target: null,
        help_text: null,
      };
      setFields((cur) => [...cur, newF]);
      setSelectedId(newF.id);
      router.refresh();
    });
  }

  function removeField(id: string) {
    setError(null);
    const snapshot = fields;
    setFields((cur) => cur.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
    startTransition(async () => {
      const res = await removeIntakeFormField({
        tenant_id: tenantId,
        form_id: formId,
        field_id: id,
      });
      if (!res.ok) {
        setError(res.error);
        setFields(snapshot);
      } else {
        router.refresh();
      }
    });
  }

  function patchField(patch: Partial<IntakeFormFieldConfig>) {
    if (!selected) return;
    setError(null);
    const snapshot = fields;
    const next = fields.map((f) =>
      f.id === selected.id ? { ...f, ...patch } : f,
    );
    setFields(next);
    startTransition(async () => {
      const res = await updateIntakeFormField({
        tenant_id: tenantId,
        form_id: formId,
        field_id: selected.id,
        field: patch,
      });
      if (!res.ok) {
        setError(res.error);
        setFields(snapshot);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr]">
      {/* Veldenlijst */}
      <section
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Velden</h3>
          <button
            type="button"
            onClick={addField}
            disabled={pending}
            className="rounded-md px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground, white)",
            }}
          >
            + Veld
          </button>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1">
              {fields.map((f) => (
                <SortableRow
                  key={f.id}
                  field={f}
                  selected={selectedId === f.id}
                  onSelect={() => setSelectedId(f.id)}
                  onRemove={() => removeField(f.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {fields.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen velden. Klik op + Veld om er een toe te voegen.
          </p>
        ) : null}

        <div className="mt-4 space-y-1 text-xs">
          {validation.is_valid ? (
            <p style={{ color: "var(--success, #15803d)" }}>
              ✓ Validatie OK — publiceren is mogelijk.
            </p>
          ) : (
            <>
              <p className="font-medium text-red-700">Validatie-problemen:</p>
              <ul className="list-disc pl-5">
                {validation.errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        {formStatus === "draft" ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={pending || !validation.is_valid}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await publishIntakeForm({
                    tenant_id: tenantId,
                    form_id: formId,
                  });
                  if (!res.ok) setError(res.error);
                  else router.refresh();
                });
              }}
              className="rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-foreground, white)",
              }}
              title={
                validation.is_valid
                  ? "Publiceer dit formulier"
                  : "Los eerst alle validatie-problemen op"
              }
            >
              Publiceer
            </button>
            {!validation.is_valid ? (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Publiceren staat uit tot validatie groen is.
              </span>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-red-700">{error}</p>
        ) : null}
      </section>

      {/* Editor */}
      <section
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="mb-3 text-sm font-medium">
          Bewerk veld {selected ? `· ${selected.key}` : ""}
        </h3>
        {!selected ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Selecteer een veld om te bewerken.
          </p>
        ) : (
          <FieldEditor
            field={selected}
            allFieldKeys={fields.map((f) => f.key)}
            onPatch={patchField}
          />
        )}
      </section>

      {/* Live preview */}
      <section
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="mb-3 text-sm font-medium">Live preview</h3>
        <div
          className="rounded-md p-3"
          style={{ backgroundColor: "var(--bg-muted, #f9fafb)" }}
        >
          {fields.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Voeg velden toe om een preview te zien.
            </p>
          ) : (
            <DynamicIntakeForm
              tenantSlug="preview"
              form={previewConfig}
              previewMode
            />
          )}
        </div>
      </section>
    </div>
  );
}

function FieldEditor({
  field,
  allFieldKeys,
  onPatch,
}: {
  field: FieldWithId;
  allFieldKeys: string[];
  onPatch: (patch: Partial<IntakeFormFieldConfig>) => void;
}) {
  const otherKeys = allFieldKeys.filter((k) => k !== field.key);
  const showOptions =
    field.field_type === "select" ||
    field.field_type === "multiselect" ||
    field.field_type === "radio";
  return (
    <div className="space-y-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Label
        </span>
        <input
          value={field.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          className="rounded-md border px-2 py-1"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Key (machine-naam, uniek per formulier)
        </span>
        <input
          value={field.key}
          onChange={(e) => onPatch({ key: e.target.value })}
          className="rounded-md border px-2 py-1 font-mono text-xs"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Help-tekst (optioneel)
        </span>
        <textarea
          value={field.help_text ?? ""}
          onChange={(e) => onPatch({ help_text: e.target.value || null })}
          rows={2}
          className="rounded-md border px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Type
        </span>
        <select
          value={field.field_type}
          onChange={(e) =>
            onPatch({ field_type: e.target.value as IntakeFieldType })
          }
          className="rounded-md border px-2 py-1"
          style={{ borderColor: "var(--border)" }}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!field.is_required}
          onChange={(e) => onPatch({ is_required: e.target.checked })}
        />
        <span className="text-xs">Verplicht veld</span>
      </label>

      {showOptions ? (
        <OptionsEditor
          value={field.options ?? []}
          onChange={(opts) => onPatch({ options: opts })}
        />
      ) : null}

      <ShowIfEditor
        value={field.show_if ?? null}
        otherKeys={otherKeys}
        onChange={(si) => onPatch({ show_if: si })}
      />

      <ValidationEditor
        value={field.validation ?? {}}
        onChange={(v) => onPatch({ validation: v })}
      />

      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Canonical target (voor gedenormaliseerde kolom)
        </span>
        <select
          value={field.canonical_target ?? ""}
          onChange={(e) =>
            onPatch({
              canonical_target: (e.target.value || null) as
                | IntakeFormFieldConfig["canonical_target"]
                | null,
            })
          }
          className="rounded-md border px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)" }}
        >
          {CANONICAL_TARGETS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          PII-klasse
        </span>
        <select
          value={field.pii_class ?? "standard"}
          onChange={(e) =>
            onPatch({
              pii_class: e.target.value as IntakeFormFieldConfig["pii_class"],
            })
          }
          className="rounded-md border px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="standard">standard</option>
          <option value="sensitive">sensitive</option>
        </select>
      </label>
    </div>
  );
}

function OptionsEditor({
  value,
  onChange,
}: {
  value: Array<{ value: string; label: string }>;
  onChange: (next: Array<{ value: string; label: string }>) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-medium">Opties</p>
      {value.map((opt, idx) => (
        <div key={idx} className="flex gap-1">
          <input
            value={opt.value}
            onChange={(e) => {
              const next = [...value];
              next[idx] = { ...next[idx], value: e.target.value };
              onChange(next);
            }}
            className="w-1/3 rounded-md border px-2 py-1 font-mono text-xs"
            style={{ borderColor: "var(--border)" }}
            placeholder="value"
          />
          <input
            value={opt.label}
            onChange={(e) => {
              const next = [...value];
              next[idx] = { ...next[idx], label: e.target.value };
              onChange(next);
            }}
            className="flex-1 rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)" }}
            placeholder="label"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== idx))}
            className="px-2 text-xs text-red-700"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            { value: `optie_${value.length + 1}`, label: `Optie ${value.length + 1}` },
          ])
        }
        className="text-xs underline"
      >
        + Optie
      </button>
    </div>
  );
}

function ShowIfEditor({
  value,
  otherKeys,
  onChange,
}: {
  value: { field_key: string; equals: string | number | boolean } | null;
  otherKeys: string[];
  onChange: (next: { field_key: string; equals: string | number | boolean } | null) => void;
}) {
  const enabled = !!value;
  return (
    <div className="space-y-2 rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            if (!e.target.checked) {
              onChange(null);
            } else {
              onChange({ field_key: otherKeys[0] ?? "", equals: "" });
            }
          }}
        />
        <span className="text-xs font-medium">Conditioneel tonen (show-if)</span>
      </label>
      {enabled ? (
        <div className="flex gap-1">
          <select
            value={value?.field_key ?? ""}
            onChange={(e) =>
              onChange({ field_key: e.target.value, equals: value?.equals ?? "" })
            }
            className="w-1/2 rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">— kies veld —</option>
            {otherKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            value={String(value?.equals ?? "")}
            onChange={(e) =>
              onChange({
                field_key: value?.field_key ?? "",
                equals: e.target.value,
              })
            }
            placeholder="gelijk aan…"
            className="flex-1 rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ValidationEditor({
  value,
  onChange,
}: {
  value: NonNullable<IntakeFormFieldConfig["validation"]>;
  onChange: (next: NonNullable<IntakeFormFieldConfig["validation"]>) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-medium">Validatie (optioneel)</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span style={{ color: "var(--text-secondary)" }}>min</span>
          <input
            type="number"
            value={value.min ?? ""}
            onChange={(e) =>
              onChange({ ...value, min: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            className="rounded-md border px-2 py-1"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span style={{ color: "var(--text-secondary)" }}>max</span>
          <input
            type="number"
            value={value.max ?? ""}
            onChange={(e) =>
              onChange({ ...value, max: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            className="rounded-md border px-2 py-1"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <span style={{ color: "var(--text-secondary)" }}>maxLength</span>
          <input
            type="number"
            value={value.maxLength ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                maxLength: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            className="rounded-md border px-2 py-1"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <span style={{ color: "var(--text-secondary)" }}>regex pattern</span>
          <input
            value={value.pattern ?? ""}
            onChange={(e) =>
              onChange({ ...value, pattern: e.target.value || undefined })
            }
            className="rounded-md border px-2 py-1 font-mono"
            style={{ borderColor: "var(--border)" }}
            placeholder="^[A-Z]+$"
          />
        </label>
      </div>
    </div>
  );
}
