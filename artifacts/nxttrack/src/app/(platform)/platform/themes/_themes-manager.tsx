"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Save, Trash2, Star, X } from "lucide-react";
import {
  NXTTRACK_LIGHT_TOKENS,
  NXTTRACK_DARK_TOKENS,
  THEME_TOKEN_KEYS,
  THEME_TOKEN_LABELS,
} from "@/lib/themes/defaults";
import { upsertTheme, deleteTheme } from "@/lib/actions/platform/themes";

export interface ThemeRowVM {
  id: string;
  scope: "platform" | "tenant";
  tenant_id: string | null;
  name: string;
  mode: "light" | "dark";
  tokens: Record<string, string>;
  is_default: boolean;
}

interface Props {
  themes: ThemeRowVM[];
  tenants: { id: string; name: string }[];
}

interface Editor {
  id?: string;
  scope: "platform" | "tenant";
  tenant_id: string | null;
  name: string;
  mode: "light" | "dark";
  tokens: Record<string, string>;
  is_default: boolean;
}

function blankEditor(mode: "light" | "dark"): Editor {
  return {
    scope: "platform",
    tenant_id: null,
    name: "",
    mode,
    tokens: { ...(mode === "dark" ? NXTTRACK_DARK_TOKENS : NXTTRACK_LIGHT_TOKENS) },
    is_default: false,
  };
}

export function ThemesManager({ themes, tenants }: Props) {
  const [pending, start] = useTransition();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const platform = themes.filter((t) => t.scope === "platform");
    const tenantThemes = themes.filter((t) => t.scope === "tenant");
    return { platform, tenantThemes };
  }, [themes]);

  function openNew(mode: "light" | "dark") {
    setEditor(blankEditor(mode));
    setMsg(null);
  }
  function openEdit(t: ThemeRowVM) {
    setEditor({
      id: t.id,
      scope: t.scope,
      tenant_id: t.tenant_id,
      name: t.name,
      mode: t.mode,
      tokens: { ...t.tokens },
      is_default: t.is_default,
    });
    setMsg(null);
  }
  function close() {
    setEditor(null);
    setMsg(null);
  }
  function setToken(key: string, value: string) {
    if (!editor) return;
    setEditor({ ...editor, tokens: { ...editor.tokens, [key]: value } });
  }
  function save() {
    if (!editor) return;
    start(async () => {
      const res = await upsertTheme({
        id: editor.id,
        scope: editor.scope,
        tenant_id: editor.scope === "tenant" ? editor.tenant_id : null,
        name: editor.name,
        mode: editor.mode,
        tokens: editor.tokens,
        is_default: editor.is_default,
      });
      if (!res.ok) return setMsg(res.error);
      setMsg("Opgeslagen.");
      setEditor(null);
    });
  }
  function remove(id: string, name: string) {
    if (!confirm(`Verwijder thema "${name}"?`)) return;
    start(async () => {
      const res = await deleteTheme({ id });
      if (!res.ok) return setMsg(res.error);
      setMsg("Verwijderd.");
    });
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          {msg}
        </div>
      )}

      <Section
        title="Platform-thema's"
        description="Voor alle clubs beschikbaar."
        themes={grouped.platform}
        tenants={tenants}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
      />
      <Section
        title="Tenant-thema's"
        description="Per club ingericht. Alleen die club kan ze activeren."
        themes={grouped.tenantThemes}
        tenants={tenants}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
      />

      {editor && (
        <ThemeEditor
          editor={editor}
          tenants={tenants}
          pending={pending}
          onChange={setEditor}
          onTokenChange={setToken}
          onSave={save}
          onClose={close}
        />
      )}
    </div>
  );
}

function Section({
  title,
  description,
  themes,
  tenants,
  onNew,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  themes: ThemeRowVM[];
  tenants: { id: string; name: string }[];
  onNew: (mode: "light" | "dark") => void;
  onEdit: (t: ThemeRowVM) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const tenantName = (id: string | null) =>
    id ? tenants.find((x) => x.id === id)?.name ?? "—" : null;
  return (
    <section
      className="rounded-2xl border p-4 sm:p-6"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNew("light")}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            <Plus className="h-3 w-3" /> Light
          </button>
          <button
            type="button"
            onClick={() => onNew("dark")}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            <Plus className="h-3 w-3" /> Dark
          </button>
        </div>
      </div>

      {themes.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen thema's.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {themes.map((t) => {
            const accent = t.tokens["--accent"] ?? "#b6d83b";
            const bg = t.tokens["--bg-app"] ?? "#fff";
            const text = t.tokens["--text-primary"] ?? "#000";
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-xs font-bold"
                  style={{
                    backgroundColor: bg,
                    borderColor: "var(--surface-border)",
                    color: text,
                  }}
                >
                  <span style={{ color: accent }}>Aa</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="flex items-center gap-1 truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {t.name}
                    {t.is_default && (
                      <Star className="h-3 w-3" style={{ color: accent }} />
                    )}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {t.mode === "dark" ? "Dark mode" : "Light mode"}
                    {t.scope === "tenant" && tenantName(t.tenant_id)
                      ? ` · ${tenantName(t.tenant_id)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="rounded-lg border px-2 py-1 text-[11px]"
                    style={{
                      borderColor: "var(--surface-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Bewerk
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(t.id, t.name)}
                    className="rounded-lg border px-2 py-1"
                    style={{ borderColor: "var(--surface-border)", color: "#b91c1c" }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ThemeEditor({
  editor,
  tenants,
  pending,
  onChange,
  onTokenChange,
  onSave,
  onClose,
}: {
  editor: Editor;
  tenants: { id: string; name: string }[];
  pending: boolean;
  onChange: (e: Editor) => void;
  onTokenChange: (k: string, v: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-5 shadow-xl"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {editor.id ? "Bewerk thema" : "Nieuw thema"}
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
          <Field label="Naam">
            <input
              value={editor.name}
              onChange={(e) => onChange({ ...editor, name: e.target.value })}
              className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            />
          </Field>
          <Field label="Mode">
            <select
              value={editor.mode}
              onChange={(e) =>
                onChange({ ...editor, mode: e.target.value as "light" | "dark" })
              }
              className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <Field label="Scope">
            <select
              value={editor.scope}
              onChange={(e) =>
                onChange({
                  ...editor,
                  scope: e.target.value as "platform" | "tenant",
                  tenant_id: e.target.value === "platform" ? null : editor.tenant_id,
                })
              }
              className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              <option value="platform">Platform-breed</option>
              <option value="tenant">Tenant-specifiek</option>
            </select>
          </Field>
          {editor.scope === "tenant" && (
            <Field label="Tenant">
              <select
                value={editor.tenant_id ?? ""}
                onChange={(e) =>
                  onChange({ ...editor, tenant_id: e.target.value || null })
                }
                className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              >
                <option value="">— kies —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <label className="col-span-full mt-1 inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={editor.is_default}
              onChange={(e) => onChange({ ...editor, is_default: e.target.checked })}
            />
            <span style={{ color: "var(--text-primary)" }}>
              Standaard voor deze mode (gebruikers krijgen dit thema als ze niets kiezen).
            </span>
          </label>
        </div>

        <div className="mt-4">
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Kleuren
          </p>
          <div className="grid gap-2">
            {THEME_TOKEN_KEYS.map((k) => (
              <TokenRow
                key={k}
                label={THEME_TOKEN_LABELS[k] ?? k}
                cssVar={k}
                value={editor.tokens[k] ?? ""}
                onChange={(v) => onTokenChange(k, v)}
              />
            ))}
          </div>
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
            disabled={pending || !editor.name.trim()}
            onClick={onSave}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--tenant-accent, #b6d83b)" }}
          >
            <Save className="h-3 w-3" /> Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
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

function TokenRow({
  label,
  cssVar,
  value,
  onChange,
}: {
  label: string;
  cssVar: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
          <code>{cssVar}</code>
        </p>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-44 rounded-lg border bg-transparent px-2 font-mono text-[11px]"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
      />
      <input
        type="color"
        disabled={!isHex}
        value={isHex ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded-lg border disabled:opacity-30"
        style={{ borderColor: "var(--surface-border)" }}
      />
    </div>
  );
}
