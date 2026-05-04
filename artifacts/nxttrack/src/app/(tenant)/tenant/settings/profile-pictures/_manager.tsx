"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createTenantTemplate,
  deleteTenantTemplate,
  saveTenantPictureSettings,
} from "@/lib/actions/tenant/profile-pictures";
import type { ProfilePictureTemplate } from "@/types/database";

export interface ProfilePicturesManagerProps {
  tenantId: string;
  tenantTemplates: ProfilePictureTemplate[];
  availableTemplates: ProfilePictureTemplate[];
  defaultTemplateId: string | null;
  allowMemberChoose: boolean;
}

export function ProfilePicturesManager({
  tenantId,
  tenantTemplates,
  availableTemplates,
  defaultTemplateId,
  allowMemberChoose,
}: ProfilePicturesManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [defId, setDefId] = useState<string | null>(defaultTemplateId);
  const [allow, setAllow] = useState(allowMemberChoose);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function add() {
    if (!name || !url) return;
    setErr(null);
    startTransition(async () => {
      const res = await createTenantTemplate({
        tenant_id: tenantId,
        name,
        image_url: url,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setName("");
      setUrl("");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Template verwijderen?")) return;
    startTransition(async () => {
      const res = await deleteTenantTemplate({ tenant_id: tenantId, template_id: id });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  function saveSettings() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await saveTenantPictureSettings({
        tenant_id: tenantId,
        default_template_id: defId,
        allow_member_choose: allow,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Opgeslagen.");
      router.refresh();
    });
  }

  const inputCls =
    "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  return (
    <div className="space-y-6">
      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Eigen templates
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input
            placeholder="Naam"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className={inputCls}
            style={inputStyle}
          />
          <input
            placeholder="https://… afbeelding-URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={pending}
            className={inputCls}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={add}
            disabled={pending || !name || !url}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> Toevoegen
          </button>
        </div>

        {tenantTemplates.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {tenantTemplates.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl border p-2"
                style={{ borderColor: "var(--surface-border)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image_url} alt={t.name} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {t.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  disabled={pending}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50"
                  style={{ color: "var(--text-secondary)" }}
                  aria-label="Verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Standaardinstellingen
        </h2>

        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Standaard template
            </label>
            <select
              value={defId ?? ""}
              onChange={(e) => setDefId(e.target.value || null)}
              disabled={pending}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— Geen —</option>
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.tenant_id === null ? " (platform)" : ""}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
            <input
              type="checkbox"
              checked={allow}
              onChange={(e) => setAllow(e.target.checked)}
              disabled={pending}
            />
            Leden mogen zelf een template kiezen
          </label>

          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{msg}</p>}

          <button
            type="button"
            onClick={saveSettings}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            {pending ? "Bezig…" : "Opslaan"}
          </button>
        </div>
      </section>
    </div>
  );
}
