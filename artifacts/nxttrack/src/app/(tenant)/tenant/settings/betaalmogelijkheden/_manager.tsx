"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Archive, ArchiveRestore, X } from "lucide-react";
import {
  archivePaymentMethod,
  createPaymentMethod,
  unarchivePaymentMethod,
  updatePaymentMethod,
} from "@/lib/actions/tenant/payment-methods";
import { PAYMENT_METHOD_TYPES } from "@/lib/validation/payment-methods";
import { formatIbanGroups } from "@/lib/iban";
import type { PaymentMethod } from "@/types/database";

const TYPE_LABEL: Record<string, string> = {
  contant: "Contant",
  rekening: "Bankoverschrijving (IBAN)",
  incasso: "Automatische incasso",
  overig: "Overig",
};

interface FormState {
  name: string;
  type: (typeof PAYMENT_METHOD_TYPES)[number];
  description: string;
  iban_for_rekening: string;
  sort_order: string;
}

const EMPTY: FormState = {
  name: "",
  type: "contant",
  description: "",
  iban_for_rekening: "",
  sort_order: "0",
};

export function PaymentMethodsManager({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: PaymentMethod[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY);

  const { active, archived } = useMemo(() => {
    return {
      active: initial.filter((m) => !m.archived_at),
      archived: initial.filter((m) => m.archived_at),
    };
  }, [initial]);

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setForm(EMPTY);
    setMsg(null);
  }

  function openEdit(m: PaymentMethod) {
    setCreating(false);
    setEditing(m);
    setForm({
      name: m.name,
      type: (m.type as FormState["type"]) ?? "contant",
      description: m.description ?? "",
      iban_for_rekening: m.iban_for_rekening ?? "",
      sort_order: String(m.sort_order ?? 0),
    });
    setMsg(null);
  }

  function close() {
    setEditing(null);
    setCreating(false);
    setMsg(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const payload = {
        tenant_id: tenantId,
        name: form.name,
        type: form.type,
        description: form.description,
        iban_for_rekening: form.type === "rekening" ? form.iban_for_rekening : "",
        sort_order: form.sort_order,
      };
      const res = editing
        ? await updatePaymentMethod({ id: editing.id, ...payload })
        : await createPaymentMethod(payload);
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: editing ? "Bijgewerkt." : "Toegevoegd." });
      close();
      router.refresh();
    });
  }

  function archive(id: string) {
    if (!confirm("Methode archiveren? Leden kunnen hem dan niet meer kiezen.")) return;
    start(async () => {
      const res = await archivePaymentMethod({ tenant_id: tenantId, id });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      router.refresh();
    });
  }

  function unarchive(id: string) {
    start(async () => {
      const res = await unarchivePaymentMethod({ tenant_id: tenantId, id });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 px-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Actieve methoden ({active.length})
        </h3>
        {!creating && !editing && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold"
            style={{ backgroundColor: "#b6d83b", color: "#111" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Voeg toe
          </button>
        )}
      </div>

      {(creating || editing) && (
        <form onSubmit={submit} className="rounded-xl border p-3" style={{ borderColor: "var(--surface-border)" }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              {editing ? "Bewerk methode" : "Nieuwe methode"}
            </p>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <X className="h-3.5 w-3.5" /> Annuleer
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Naam" required>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                maxLength={120}
                className={inputCls}
              />
            </Field>
            <Field label="Type" required>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as FormState["type"] })
                }
                className={inputCls}
              >
                {PAYMENT_METHOD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            {form.type === "rekening" && (
              <Field label="IBAN voor overschrijving" required hint="Wordt getoond bij leden die deze methode kiezen.">
                <input
                  value={form.iban_for_rekening}
                  onChange={(e) =>
                    setForm({ ...form, iban_for_rekening: e.target.value.toUpperCase() })
                  }
                  required
                  placeholder="NL00 BANK 0123 4567 89"
                  className={`${inputCls} font-mono uppercase`}
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
            )}
            <Field label="Volgorde" hint="Lager = eerder in de keuzelijst.">
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Omschrijving" hint="Optioneel — getoond aan leden bij keuze.">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={500}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            {msg && (
              <span className={msg.kind === "ok" ? "text-xs text-emerald-600" : "text-xs text-red-600"}>
                {msg.text}
              </span>
            )}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#b6d83b", color: "#111" }}
            >
              {pending ? "Bezig…" : editing ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </form>
      )}

      <PaymentMethodList
        rows={active}
        onEdit={openEdit}
        onArchive={archive}
        onUnarchive={null}
      />

      {archived.length > 0 && (
        <>
          <h3 className="px-2 pt-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Gearchiveerd ({archived.length})
          </h3>
          <PaymentMethodList
            rows={archived}
            onEdit={null}
            onArchive={null}
            onUnarchive={unarchive}
          />
        </>
      )}

      {msg && !creating && !editing && (
        <p className={msg.kind === "ok" ? "px-2 text-xs text-emerald-600" : "px-2 text-xs text-red-600"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function PaymentMethodList({
  rows,
  onEdit,
  onArchive,
  onUnarchive,
}: {
  rows: PaymentMethod[];
  onEdit: ((m: PaymentMethod) => void) | null;
  onArchive: ((id: string) => void) | null;
  onUnarchive: ((id: string) => void) | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        Geen items.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((m) => (
        <li
          key={m.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {m.name}
              <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--text-secondary)" }}>
                {TYPE_LABEL[m.type as string] ?? m.type}
              </span>
            </p>
            {m.iban_for_rekening && (
              <p className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                {formatIbanGroups(m.iban_for_rekening)}
              </p>
            )}
            {m.description && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {m.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(m)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                <Pencil className="h-3.5 w-3.5" /> Bewerk
              </button>
            )}
            {onArchive && (
              <button
                type="button"
                onClick={() => onArchive(m.id)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                <Archive className="h-3.5 w-3.5" /> Archiveer
              </button>
            )}
            {onUnarchive && (
              <button
                type="button"
                onClick={() => onUnarchive(m.id)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                <ArchiveRestore className="h-3.5 w-3.5" /> Activeer
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

const inputCls =
  "mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
      {label}
      {required && <span className="text-red-500"> *</span>}
      {children}
      {hint && (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}
