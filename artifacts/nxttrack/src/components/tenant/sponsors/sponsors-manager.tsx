"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createSponsor,
  deleteSponsor,
  updateSponsor,
} from "@/lib/actions/tenant/sponsors";
import type { Sponsor } from "@/types/database";

interface Props {
  tenantId: string;
  initial: Sponsor[];
}

const inputClass = "w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: "var(--surface-border)", color: "var(--text-primary)" } as const;

export function SponsorsManager({ tenantId, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Sponsor[]>(initial);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    logo_url: "",
    website_url: "",
    is_active: true,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createSponsor({
        tenant_id: tenantId,
        name: form.name,
        logo_url: form.logo_url || null,
        website_url: form.website_url || null,
        is_active: form.is_active,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function toggle(s: Sponsor) {
    setItems((prev) => prev.map((p) => (p.id === s.id ? { ...p, is_active: !p.is_active } : p)));
    start(async () => {
      await updateSponsor({ tenant_id: tenantId, id: s.id, is_active: !s.is_active });
    });
  }

  function remove(s: Sponsor) {
    if (!confirm("Verwijderen?")) return;
    setItems((prev) => prev.filter((p) => p.id !== s.id));
    start(async () => {
      await deleteSponsor({ tenant_id: tenantId, id: s.id });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" /> Nieuwe sponsor
        </button>
      </div>

      {open && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-lg border p-4"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
        >
          <input
            required
            placeholder="Naam"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
          <input
            type="url"
            placeholder="Logo URL"
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
          <input
            type="url"
            placeholder="Website URL"
            value={form.website_url}
            onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span style={{ color: "var(--text-primary)" }}>Actief</span>
          </label>
          {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              Opslaan
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
          Nog geen sponsoren.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
              >
                {s.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo_url} alt={s.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    geen logo
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {s.name}
                </p>
                {s.website_url && (
                  <p className="truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {s.website_url}
                  </p>
                )}
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {s.is_active ? "Actief" : "Inactief"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(s)}
                className="rounded border px-2 py-1 text-[11px] font-semibold"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              >
                {s.is_active ? "Uit" : "Aan"}
              </button>
              <button type="button" onClick={() => remove(s)} aria-label="Verwijder">
                <Trash2 className="h-4 w-4" style={{ color: "#dc2626" }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
