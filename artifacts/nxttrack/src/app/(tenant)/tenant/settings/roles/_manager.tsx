"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Save,
  Trash2,
  X,
  Shield,
  ShieldCheck,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PERMISSION_CATALOG } from "@/lib/permissions/catalog";
import {
  upsertTenantRole,
  deleteTenantRole,
} from "@/lib/actions/tenant/roles";
import type { TenantRoleScope } from "@/types/database";

interface RoleVM {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  sort_order: number;
  permissions: string[];
  member_count: number;
  scope: TenantRoleScope;
  /** True voor de super-admin systeemrol. */
  is_super_admin: boolean;
}

interface Editor {
  id?: string;
  name: string;
  description: string;
  permissions: Set<string>;
  sort_order: number;
  scope: TenantRoleScope;
  is_super_admin: boolean;
}

function blank(scope: TenantRoleScope): Editor {
  return {
    name: "",
    description: "",
    permissions: new Set(),
    sort_order: 100,
    scope,
    is_super_admin: false,
  };
}

interface Props {
  tenantId: string;
  roles: RoleVM[];
}

const SCOPE_LABEL: Record<TenantRoleScope, string> = {
  admin: "Beheerders (backend)",
  usershell: "Frontend (gebruikers)",
};

export function RolesManager({ tenantId, roles: initialRoles }: Props) {
  const [roles, setRoles] = useState<RoleVM[]>(initialRoles);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TenantRoleScope>("admin");
  const [pending, start] = useTransition();

  const visibleRoles = useMemo(
    () => roles.filter((r) => r.scope === activeTab),
    [roles, activeTab],
  );

  function openNew() {
    setMsg(null);
    setEditor(blank(activeTab));
  }

  function openEdit(r: RoleVM) {
    setMsg(null);
    setEditor({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      permissions: new Set(r.permissions),
      sort_order: r.sort_order,
      scope: r.scope,
      is_super_admin: r.is_super_admin,
    });
  }

  function save() {
    if (!editor) return;
    setMsg(null);
    start(async () => {
      const res = await upsertTenantRole({
        id: editor.id,
        tenant_id: tenantId,
        name: editor.name.trim(),
        description: editor.description.trim() || null,
        permissions: Array.from(editor.permissions),
        sort_order: editor.sort_order,
        scope: editor.scope,
        is_super_admin: editor.is_super_admin,
      });
      if (!res.ok) return setMsg(res.error);
      const existing = editor.id ? roles.find((r) => r.id === editor.id) : null;
      const newRow: RoleVM = {
        id: res.data.id,
        name: existing?.is_super_admin ? existing.name : editor.name.trim(),
        description: editor.description.trim() || null,
        is_system: existing?.is_system ?? false,
        sort_order: existing?.is_super_admin ? existing.sort_order : editor.sort_order,
        permissions: existing?.is_super_admin
          ? existing.permissions
          : Array.from(editor.permissions),
        member_count: existing?.member_count ?? 0,
        scope: existing?.scope ?? editor.scope,
        is_super_admin: existing?.is_super_admin ?? editor.is_super_admin,
      };
      setRoles((prev) =>
        editor.id
          ? prev.map((r) => (r.id === editor.id ? newRow : r))
          : [...prev, newRow],
      );
      setEditor(null);
      setMsg("Opgeslagen.");
    });
  }

  function remove(r: RoleVM) {
    if (r.is_system) {
      setMsg("Systeemrol kan niet verwijderd worden.");
      return;
    }
    if (!confirm(`Verwijder rol "${r.name}"?`)) return;
    start(async () => {
      const res = await deleteTenantRole({ tenant_id: tenantId, id: r.id });
      if (!res.ok) return setMsg(res.error);
      setRoles((prev) => prev.filter((x) => x.id !== r.id));
      setMsg("Verwijderd.");
    });
  }

  return (
    <div className="space-y-4">
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

      <div
        className="inline-flex rounded-lg border p-1"
        style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
      >
        {(["admin", "usershell"] as TenantRoleScope[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setActiveTab(s)}
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: activeTab === s ? "var(--accent)" : "transparent",
              color: "var(--text-primary)",
            }}
          >
            {SCOPE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {visibleRoles.length} {visibleRoles.length === 1 ? "rol" : "rollen"} in{" "}
          {SCOPE_LABEL[activeTab].toLowerCase()}
        </p>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-3 w-3" /> Nieuwe rol
        </button>
      </div>

      <ul className="grid gap-2">
        {visibleRoles.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 rounded-2xl border p-4 transition-colors hover:bg-black/[0.02]"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: r.is_super_admin
                  ? "var(--accent)"
                  : r.is_system
                    ? "var(--surface-soft)"
                    : "var(--surface-soft)",
                color: "var(--text-primary)",
              }}
            >
              {r.is_super_admin ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {r.name}
                </p>
                {r.is_super_admin && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                  >
                    super admin
                  </span>
                )}
                {r.is_system && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}
                  >
                    systeem
                  </span>
                )}
              </div>
              {r.description && (
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {r.description}
                </p>
              )}
              <div
                className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {r.member_count} leden
                </span>
                <span>· {r.permissions.length} permissies</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => openEdit(r)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5"
                style={{ color: "var(--text-secondary)" }}
              >
                Bewerken
              </button>
              {!r.is_system && (
                <button
                  type="button"
                  onClick={() => remove(r)}
                  className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
                  style={{ color: "#b91c1c" }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
        {visibleRoles.length === 0 && (
          <li
            className="rounded-2xl border p-6 text-center text-xs"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          >
            Nog geen rollen in deze categorie.
          </li>
        )}
      </ul>

      {editor && (() => {
        const cur = editor.id ? roles.find((r) => r.id === editor.id) : null;
        return (
          <RoleEditor
            editor={editor}
            isSystem={cur?.is_system ?? false}
            isSuperAdmin={cur?.is_super_admin ?? editor.is_super_admin}
            isNew={!editor.id}
            onChange={setEditor}
            onSave={save}
            onClose={() => setEditor(null)}
            pending={pending}
          />
        );
      })()}
    </div>
  );
}

function RoleEditor({
  editor,
  isSystem,
  isSuperAdmin,
  isNew,
  onChange,
  onSave,
  onClose,
  pending,
}: {
  editor: Editor;
  isSystem: boolean;
  isSuperAdmin: boolean;
  isNew: boolean;
  onChange: (e: Editor) => void;
  onSave: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const g of PERMISSION_CATALOG) o[g.id] = true;
    return o;
  });

  const totalSelected = editor.permissions.size;
  const totalAvail = useMemo(
    () => PERMISSION_CATALOG.reduce((acc, g) => acc + g.permissions.length, 0),
    [],
  );
  const permsLocked = isSuperAdmin;

  function togglePerm(key: string) {
    if (permsLocked) return;
    const next = new Set(editor.permissions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...editor, permissions: next });
  }

  function toggleGroup(groupId: string, allKeys: string[]) {
    if (permsLocked) return;
    const allOn = allKeys.every((k) => editor.permissions.has(k));
    const next = new Set(editor.permissions);
    if (allOn) {
      allKeys.forEach((k) => next.delete(k));
    } else {
      allKeys.forEach((k) => next.add(k));
    }
    onChange({ ...editor, permissions: next });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="flex w-full max-w-3xl max-h-[92vh] flex-col gap-3 overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {editor.id ? "Rol bewerken" : "Nieuwe rol"}
              {isSuperAdmin && (
                <span
                  className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                >
                  super admin · permissies vergrendeld
                </span>
              )}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {permsLocked
                ? `Alle ${totalAvail} permissies zijn altijd actief.`
                : `${totalSelected} van ${totalAvail} permissies geselecteerd`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-black/5"
            style={{ color: "var(--text-secondary)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 pb-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Naam
              </label>
              <input
                value={editor.name}
                onChange={(e) => onChange({ ...editor, name: e.target.value })}
                disabled={isSystem || isSuperAdmin}
                placeholder="Bv. Hoofdtrainer, Bestuur, …"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-60"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Volgorde
              </label>
              <input
                type="number"
                value={editor.sort_order}
                onChange={(e) =>
                  onChange({ ...editor, sort_order: Number(e.target.value) || 0 })
                }
                disabled={isSuperAdmin}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-60"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {isNew && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Categorie
                </label>
                <select
                  value={editor.scope}
                  onChange={(e) => {
                    const next = e.target.value as TenantRoleScope;
                    onChange({
                      ...editor,
                      scope: next,
                      is_super_admin: next === "admin" ? editor.is_super_admin : false,
                    });
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--surface-soft)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="admin">Beheerders (toegang tot tenant admin)</option>
                  <option value="usershell">Frontend (alleen gebruikersshell)</option>
                </select>
              </div>
              {editor.scope === "admin" && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Super admin
                  </span>
                  <span
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                    style={{
                      backgroundColor: "var(--surface-soft)",
                      borderColor: "var(--surface-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editor.is_super_admin}
                      onChange={(e) =>
                        onChange({ ...editor, is_super_admin: e.target.checked })
                      }
                      className="h-3.5 w-3.5"
                    />
                    Geef automatisch alle permissies (vergrendeld)
                  </span>
                </label>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Omschrijving
            </label>
            <textarea
              value={editor.description}
              onChange={(e) => onChange({ ...editor, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div
            className="rounded-2xl border"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-3 py-2"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Permissies
              </p>
              {!permsLocked && (
                <button
                  type="button"
                  onClick={() => {
                    const allOn = totalSelected === totalAvail;
                    if (allOn) {
                      onChange({ ...editor, permissions: new Set() });
                    } else {
                      const all = new Set<string>();
                      for (const g of PERMISSION_CATALOG)
                        for (const p of g.permissions) all.add(p.key);
                      onChange({ ...editor, permissions: all });
                    }
                  }}
                  className="text-[11px] font-semibold underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {totalSelected === totalAvail ? "Alles uit" : "Alles aan"}
                </button>
              )}
            </div>
            <div className="space-y-1 px-2 py-2">
              {PERMISSION_CATALOG.map((g) => {
                const groupKeys = g.permissions.map((p) => p.key);
                const selectedInGroup = permsLocked
                  ? groupKeys.length
                  : groupKeys.filter((k) => editor.permissions.has(k)).length;
                const allOn = selectedInGroup === groupKeys.length;
                const open = !!openGroups[g.id];
                return (
                  <div
                    key={g.id}
                    className="rounded-xl border"
                    style={{
                      backgroundColor: "var(--surface-main)",
                      borderColor: "var(--surface-border)",
                    }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setOpenGroups((p) => ({ ...p, [g.id]: !p[g.id] }))}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        {open ? (
                          <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--text-secondary)" }} />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--text-secondary)" }} />
                        )}
                        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                          {g.label}
                        </span>
                        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          ({selectedInGroup}/{groupKeys.length})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.id, groupKeys)}
                        disabled={permsLocked}
                        className="rounded-md px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
                        style={{
                          backgroundColor: allOn ? "var(--accent)" : "var(--surface-soft)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {allOn ? "Alles aan" : "Selecteer alles"}
                      </button>
                    </div>
                    {open && (
                      <div className="grid grid-cols-1 gap-1 border-t px-3 py-2 sm:grid-cols-2"
                        style={{ borderColor: "var(--surface-border)" }}>
                        {g.permissions.map((p) => {
                          const checked = permsLocked || editor.permissions.has(p.key);
                          return (
                            <label
                              key={p.key}
                              className={
                                permsLocked
                                  ? "flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs opacity-80"
                                  : "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-black/5"
                              }
                              style={{ color: "var(--text-primary)" }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={permsLocked}
                                onChange={() => togglePerm(p.key)}
                                className="mt-0.5 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span className="flex-1">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !editor.name.trim()}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Save className="h-3 w-3" /> Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
