"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertTriangle, Megaphone } from "lucide-react";
import {
  createAlert,
  deleteAlert,
  toggleAlertActive,
} from "@/lib/actions/tenant/alerts";
import type { Alert } from "@/types/database";

interface Props {
  tenantId: string;
  initial: Alert[];
}

const inputClass =
  "w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
} as const;

export function AlertsManager({ tenantId, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Alert[]>(initial);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    content: "",
    type: "announcement" as "announcement" | "alert",
    is_active: true,
    start_at: "",
    end_at: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createAlert({
        tenant_id: tenantId,
        title: form.title,
        content: form.content || null,
        type: form.type,
        is_active: form.is_active,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function toggle(a: Alert) {
    setItems((prev) =>
      prev.map((p) => (p.id === a.id ? { ...p, is_active: !p.is_active } : p)),
    );
    start(async () => {
      await toggleAlertActive({ tenant_id: tenantId, id: a.id, is_active: !a.is_active });
    });
  }

  function remove(a: Alert) {
    if (!confirm("Verwijderen?")) return;
    setItems((prev) => prev.filter((p) => p.id !== a.id));
    start(async () => {
      await deleteAlert({ tenant_id: tenantId, id: a.id });
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
          <Plus className="h-4 w-4" /> Nieuwe melding
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
              required
              placeholder="Titel"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "alert" | "announcement" })}
              className={inputClass}
              style={inputStyle}
            >
              <option value="announcement">Aankondiging</option>
              <option value="alert">Alert</option>
            </select>
          </div>
          <textarea
            placeholder="Inhoud (optioneel)"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={3}
            className={inputClass}
            style={inputStyle}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                Start (optioneel)
              </span>
              <input
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                Einde (optioneel)
              </span>
              <input
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span style={{ color: "var(--text-primary)" }}>Direct activeren</span>
          </label>
          {error && (
            <p className="text-xs" style={{ color: "#dc2626" }}>
              {error}
            </p>
          )}
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
          Nog geen meldingen.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const isAlert = a.type === "alert";
            const Icon = isAlert ? AlertTriangle : Megaphone;
            return (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-lg border p-3"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: isAlert ? "#dc2626" : "var(--accent)" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {a.title}
                  </p>
                  {a.content && (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {a.content}
                    </p>
                  )}
                  <p className="mt-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {a.is_active ? "Actief" : "Inactief"}
                    {a.start_at ? ` • vanaf ${new Date(a.start_at).toLocaleString("nl-NL")}` : ""}
                    {a.end_at ? ` • t/m ${new Date(a.end_at).toLocaleString("nl-NL")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(a)}
                  className="rounded border px-2 py-1 text-[11px] font-semibold"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                >
                  {a.is_active ? "Uit" : "Aan"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(a)}
                  className="rounded p-1.5"
                  aria-label="Verwijder"
                >
                  <Trash2 className="h-4 w-4" style={{ color: "#dc2626" }} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
