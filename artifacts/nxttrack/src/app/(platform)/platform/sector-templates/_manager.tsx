"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, X, FolderOpen } from "lucide-react";
import {
  TERMINOLOGY_KEYS,
  TERMINOLOGY_KEY_LABELS,
} from "@/lib/terminology/labels";
import { DEFAULT_TERMINOLOGY } from "@/lib/terminology/defaults";
import {
  createSectorTemplate,
  updateSectorTemplate,
  deleteSectorTemplate,
} from "@/lib/actions/platform/sector-templates";
import type { TerminologyKey } from "@/lib/terminology/types";

export interface SectorTemplateVM {
  key: string;
  name: string;
  description: string | null;
  terminology_json: Record<string, string>;
  default_modules_json: unknown[];
  is_active: boolean;
}

interface Editor {
  mode: "create" | "edit";
  key: string;
  name: string;
  description: string;
  terminology: Record<string, string>;
  default_modules_text: string;
  is_active: boolean;
}

function blankEditor(): Editor {
  return {
    mode: "create",
    key: "",
    name: "",
    description: "",
    terminology: {},
    default_modules_text: "[]",
    is_active: true,
  };
}

function fromTemplate(t: SectorTemplateVM): Editor {
  return {
    mode: "edit",
    key: t.key,
    name: t.name,
    description: t.description ?? "",
    terminology: { ...t.terminology_json },
    default_modules_text: JSON.stringify(t.default_modules_json ?? [], null, 2),
    is_active: t.is_active,
  };
}

interface Props {
  templates: SectorTemplateVM[];
}

export function SectorTemplatesManager({ templates }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  );

  function flash(text: string) {
    setMsg(text);
    setErr(null);
    setTimeout(() => setMsg(null), 2500);
  }
  function flashErr(text: string) {
    setErr(text);
    setMsg(null);
  }

  function onSave() {
    if (!editor) return;
    setErr(null);
    let modules: unknown[] = [];
    try {
      const raw = JSON.parse(editor.default_modules_text || "[]");
      if (!Array.isArray(raw)) throw new Error("Moet een JSON-array zijn");
      modules = raw;
    } catch (e) {
      flashErr(`Standaardmodules JSON ongeldig: ${(e as Error).message}`);
      return;
    }
    const terminology: Record<string, string> = {};
    for (const k of TERMINOLOGY_KEYS) {
      const v = editor.terminology[k];
      if (typeof v === "string" && v.trim().length > 0) terminology[k] = v.trim();
    }

    start(async () => {
      if (editor.mode === "create") {
        const res = await createSectorTemplate({
          key: editor.key,
          name: editor.name,
          description: editor.description || null,
          terminology_json: terminology,
          default_modules_json: modules,
          is_active: editor.is_active,
        });
        if (!res.ok) {
          flashErr(res.error);
          return;
        }
        flash("Template aangemaakt.");
        setEditor(null);
        router.refresh();
      } else {
        const res = await updateSectorTemplate({
          key: editor.key,
          name: editor.name,
          description: editor.description || null,
          terminology_json: terminology,
          default_modules_json: modules,
          is_active: editor.is_active,
        });
        if (!res.ok) {
          flashErr(res.error);
          return;
        }
        flash("Template bijgewerkt.");
        setEditor(null);
        router.refresh();
      }
    });
  }

  function onDelete(key: string) {
    if (!confirm(`Template "${key}" verwijderen? Tenants die deze gebruiken vallen terug op generic.`)) return;
    start(async () => {
      const res = await deleteSectorTemplate({ key });
      if (!res.ok) {
        flashErr(res.error);
        return;
      }
      flash("Template verwijderd.");
      if (editor?.key === key) setEditor(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {(msg || err) && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={
            err
              ? { borderColor: "rgb(252 165 165)", backgroundColor: "rgb(254 242 242)", color: "rgb(153 27 27)" }
              : { borderColor: "rgb(167 243 208)", backgroundColor: "rgb(236 253 245)", color: "rgb(6 95 70)" }
          }
        >
          {err ?? msg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditor(blankEditor())}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-3.5 w-3.5" /> Nieuwe template
        </button>
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <table className="w-full text-sm">
          <thead style={{ color: "var(--text-secondary)" }}>
            <tr className="text-left text-xs uppercase tracking-wide">
              <th className="px-5 py-3">Key</th>
              <th className="px-5 py-3">Naam</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Overrides</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                  Nog geen sector-templates.
                </td>
              </tr>
            )}
            {sorted.map((t) => (
              <tr
                key={t.key}
                className="border-t"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <td className="px-5 py-3 font-mono text-xs">{t.key}</td>
                <td className="px-5 py-3">{t.name}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {t.is_active ? "Actief" : "Inactief"}
                </td>
                <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {Object.keys(t.terminology_json ?? {}).length} keys
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditor(fromTemplate(t))}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-black/5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Open
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(t.key)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-50"
                      style={{ color: "rgb(153 27 27)" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editor && (
        <SectorTemplateEditor
          editor={editor}
          pending={pending}
          onChange={setEditor}
          onSave={onSave}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

function SectorTemplateEditor({
  editor,
  pending,
  onChange,
  onSave,
  onClose,
}: {
  editor: Editor;
  pending: boolean;
  onChange: (e: Editor) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {editor.mode === "create" ? "Nieuwe template" : `Template: ${editor.key}`}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 hover:bg-black/5"
          style={{ color: "var(--text-secondary)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Key">
          <input
            disabled={editor.mode === "edit"}
            value={editor.key}
            onChange={(e) => onChange({ ...editor, key: e.target.value })}
            placeholder="dance_school"
            className="h-9 w-full rounded-lg border bg-transparent px-2 font-mono text-xs disabled:opacity-60"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          />
        </Field>
        <Field label="Naam">
          <input
            value={editor.name}
            onChange={(e) => onChange({ ...editor, name: e.target.value })}
            placeholder="Dansschool"
            className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          />
        </Field>
        <Field label="Beschrijving" className="sm:col-span-2">
          <input
            value={editor.description}
            onChange={(e) => onChange({ ...editor, description: e.target.value })}
            placeholder="Standaardtermen voor dansscholen."
            className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          />
        </Field>
        <label className="col-span-full inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={editor.is_active}
            onChange={(e) => onChange({ ...editor, is_active: e.target.checked })}
          />
          <span style={{ color: "var(--text-primary)" }}>
            Actief — beschikbaar als keuze voor tenants.
          </span>
        </label>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Terminologie
        </p>
        <p className="mb-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Lege velden vallen terug op de generic-template en uiteindelijk op de hardcoded NXTTRACK-defaults.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TERMINOLOGY_KEYS.map((k: TerminologyKey) => (
            <Field key={k} label={TERMINOLOGY_KEY_LABELS[k]}>
              <input
                value={editor.terminology[k] ?? ""}
                placeholder={DEFAULT_TERMINOLOGY[k]}
                onChange={(e) =>
                  onChange({
                    ...editor,
                    terminology: { ...editor.terminology, [k]: e.target.value },
                  })
                }
                className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Standaardmodules (JSON)
        </p>
        <p className="mb-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Optioneel — gereserveerd voor sector-default homepage-modules. Moet een JSON-array zijn.
        </p>
        <textarea
          value={editor.default_modules_text}
          onChange={(e) => onChange({ ...editor, default_modules_text: e.target.value })}
          rows={6}
          className="w-full rounded-lg border bg-transparent p-2 font-mono text-xs"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
        >
          Annuleer
        </button>
        <button
          type="button"
          disabled={pending || !editor.name.trim() || !editor.key.trim()}
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Save className="h-3 w-3" /> Opslaan
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        className="mb-1 block text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
