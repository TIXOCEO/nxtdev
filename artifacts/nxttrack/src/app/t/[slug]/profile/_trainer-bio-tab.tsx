"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { saveAnswers } from "@/lib/actions/tenant/trainer-bio";
import type {
  TrainerBioField,
  TrainerBioAnswer,
  TrainerBioSection,
  TrainerBioFieldType,
} from "@/lib/db/trainer-bio";

export interface TrainerBioTabProps {
  tenantId: string;
  memberId: string;
  sections: TrainerBioSection[];
  fields: TrainerBioField[];
  answers: TrainerBioAnswer[];
}

interface AnswerState {
  text: string;
  number: string;
  date: string;
  list: string[];
}

function emptyAnswer(): AnswerState {
  return { text: "", number: "", date: "", list: [] };
}

function fromAnswer(a: TrainerBioAnswer | undefined): AnswerState {
  if (!a) return emptyAnswer();
  return {
    text: a.value_text ?? "",
    number: a.value_number !== null && a.value_number !== undefined ? String(a.value_number) : "",
    date: a.value_date ?? "",
    list: Array.isArray(a.value_list) ? a.value_list : [],
  };
}

export function TrainerBioTab({
  tenantId,
  memberId,
  sections,
  fields,
  answers,
}: TrainerBioTabProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const initial = useMemo(() => {
    const byField = new Map<string, TrainerBioAnswer>();
    for (const a of answers) byField.set(a.field_id, a);
    const map = new Map<string, AnswerState>();
    for (const f of fields) map.set(f.id, fromAnswer(byField.get(f.id)));
    return map;
  }, [answers, fields]);

  const [state, setState] = useState<Map<string, AnswerState>>(initial);

  function update(fieldId: string, patch: Partial<AnswerState>) {
    setState((prev) => {
      const next = new Map(prev);
      next.set(fieldId, { ...(prev.get(fieldId) ?? emptyAnswer()), ...patch });
      return next;
    });
  }

  const fieldsBySection = useMemo(() => {
    const m = new Map<string, TrainerBioField[]>();
    for (const f of fields) {
      const arr = m.get(f.section_id) ?? [];
      arr.push(f);
      m.set(f.section_id, arr);
    }
    return m;
  }, [fields]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const payload = fields.map((f) => {
      const v = state.get(f.id) ?? emptyAnswer();
      return toAnswerPayload(f.id, f.field_type, v);
    });
    start(async () => {
      const res = await saveAnswers({
        tenant_id: tenantId,
        member_id: memberId,
        answers: payload,
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Je trainersbio is opgeslagen." });
      router.refresh();
    });
  }

  if (sections.length === 0) {
    return (
      <p
        className="rounded-2xl border p-4 text-sm"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
          color: "var(--text-secondary)",
        }}
      >
        Er is nog geen trainersbio-formulier ingericht.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {sections.map((s) => {
        const list = fieldsBySection.get(s.id) ?? [];
        if (list.length === 0) return null;
        return (
          <section
            key={s.id}
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
            }}
          >
            <h3
              className="mb-3 text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {s.label}
            </h3>
            <div className="space-y-3">
              {list.map((f) => (
                <FieldInput
                  key={f.id}
                  field={f}
                  value={state.get(f.id) ?? emptyAnswer()}
                  onChange={(p) => update(f.id, p)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex items-center justify-end gap-3">
        {msg && (
          <span
            className={msg.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-red-600"}
          >
            {msg.text}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "#b6d83b", color: "#111" }}
        >
          {pending ? "Bezig…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}

function toAnswerPayload(
  fieldId: string,
  type: TrainerBioFieldType,
  v: AnswerState,
): {
  field_id: string;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_list?: string[] | null;
} {
  const out: ReturnType<typeof toAnswerPayload> = {
    field_id: fieldId,
    value_text: null,
    value_number: null,
    value_date: null,
    value_list: null,
  };
  switch (type) {
    case "short_text":
    case "long_text":
      out.value_text = v.text.trim() ? v.text : null;
      break;
    case "number":
      out.value_number = v.number.trim() ? Number(v.number) : null;
      break;
    case "date":
      out.value_date = v.date || null;
      break;
    case "bullet_list":
      out.value_list =
        v.list.filter((s) => s && s.trim().length > 0).length > 0
          ? v.list.filter((s) => s && s.trim().length > 0)
          : null;
      break;
  }
  return out;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TrainerBioField;
  value: AnswerState;
  onChange: (p: Partial<AnswerState>) => void;
}) {
  const labelEl = (
    <span
      className="mb-1 block text-xs font-medium"
      style={{ color: "var(--text-secondary)" }}
    >
      {field.label}
    </span>
  );
  const inputCls =
    "block w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-soft)",
  } as const;

  if (field.field_type === "short_text") {
    return (
      <label className="block">
        {labelEl}
        <input
          value={value.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className={inputCls + " h-10"}
          style={inputStyle}
        />
      </label>
    );
  }
  if (field.field_type === "long_text") {
    return (
      <label className="block">
        {labelEl}
        <textarea
          value={value.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={4}
          className={inputCls}
          style={inputStyle}
        />
      </label>
    );
  }
  if (field.field_type === "number") {
    return (
      <label className="block">
        {labelEl}
        <input
          type="number"
          value={value.number}
          onChange={(e) => onChange({ number: e.target.value })}
          className={inputCls + " h-10"}
          style={inputStyle}
        />
      </label>
    );
  }
  if (field.field_type === "date") {
    return (
      <label className="block">
        {labelEl}
        <input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className={inputCls + " h-10"}
          style={inputStyle}
        />
      </label>
    );
  }
  // bullet_list
  return (
    <div>
      {labelEl}
      <ul className="space-y-1">
        {value.list.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => {
                const next = [...value.list];
                next[i] = e.target.value;
                onChange({ list: next });
              }}
              className={inputCls + " h-9"}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => onChange({ list: value.list.filter((_, j) => j !== i) })}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
              style={{
                borderColor: "var(--surface-border)",
                color: "#dc2626",
              }}
              aria-label="Verwijderen"
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange({ list: [...value.list, ""] })}
        className="mt-2 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
        }}
      >
        <Plus className="h-3 w-3" /> Item toevoegen
      </button>
    </div>
  );
}
