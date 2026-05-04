"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createMediaWallItem,
  deleteMediaWallItem,
  updateMediaWallItem,
} from "@/lib/actions/tenant/media-wall";
import type { MediaWallItem } from "@/types/database";

interface Props {
  tenantId: string;
  initial: MediaWallItem[];
}

const inputClass = "w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: "var(--surface-border)", color: "var(--text-primary)" } as const;

export function MediaWallManager({ tenantId, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<MediaWallItem[]>(initial);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    media_url: "",
    media_type: "image" as "image" | "video",
    is_active: true,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createMediaWallItem({
        tenant_id: tenantId,
        title: form.title || null,
        media_url: form.media_url,
        media_type: form.media_type,
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

  function toggle(it: MediaWallItem) {
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, is_active: !p.is_active } : p)));
    start(async () => {
      await updateMediaWallItem({ tenant_id: tenantId, id: it.id, is_active: !it.is_active });
    });
  }

  function remove(it: MediaWallItem) {
    if (!confirm("Verwijderen?")) return;
    setItems((prev) => prev.filter((p) => p.id !== it.id));
    start(async () => {
      await deleteMediaWallItem({ tenant_id: tenantId, id: it.id });
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
          <Plus className="h-4 w-4" /> Nieuw item
        </button>
      </div>

      {open && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-lg border p-4"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              placeholder="Titel (optioneel)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
            <select
              value={form.media_type}
              onChange={(e) => setForm({ ...form, media_type: e.target.value as "image" | "video" })}
              className={inputClass}
              style={inputStyle}
            >
              <option value="image">Afbeelding</option>
              <option value="video">Video</option>
            </select>
          </div>
          <input
            required
            type="url"
            placeholder="https://… media URL"
            value={form.media_url}
            onChange={(e) => setForm({ ...form, media_url: e.target.value })}
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
          Nog geen items.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <li
              key={it.id}
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
            >
              <div className="aspect-square w-full" style={{ backgroundColor: "var(--surface-soft)" }}>
                {it.media_type === "video" ? (
                  <video src={it.media_url} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.media_url} alt={it.title ?? ""} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {it.title || it.media_type}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {it.is_active ? "Actief" : "Inactief"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(it)}
                  className="rounded border px-2 py-1 text-[10px] font-semibold"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                >
                  {it.is_active ? "Uit" : "Aan"}
                </button>
                <button type="button" onClick={() => remove(it)} aria-label="Verwijder">
                  <Trash2 className="h-3.5 w-3.5" style={{ color: "#dc2626" }} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
