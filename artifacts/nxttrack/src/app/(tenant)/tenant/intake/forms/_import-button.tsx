"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importSectorDefaultAsForm } from "@/lib/actions/tenant/intake-forms";

export function IntakeFormImportButton({
  tenantId,
  sectorKeys,
}: {
  tenantId: string;
  sectorKeys: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sector, setSector] = useState(sectorKeys[0] ?? "generic");
  const [slug, setSlug] = useState("proefles-template");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await importSectorDefaultAsForm({
        tenant_id: tenantId,
        sector_key: sector,
        slug: slug.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/tenant/intake/forms/${res.data.form_id}/builder`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border px-3 py-1.5 text-sm font-medium"
        style={{ borderColor: "var(--border)" }}
      >
        Importeer sector-template
      </button>
    );
  }

  return (
    <div
      className="flex flex-wrap items-end gap-2 rounded-md p-3"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
    >
      <label className="flex flex-col text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Sector</span>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="mt-1 rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          {sectorKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Slug</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="mt-1 rounded-md border px-2 py-1 text-sm font-mono"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending || !slug.trim()}
        className="rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground, white)",
        }}
      >
        {pending ? "Bezig…" : "Importeer"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md px-3 py-1.5 text-sm underline"
        style={{ color: "var(--text-secondary)" }}
      >
        Annuleren
      </button>
      {error ? <p className="text-xs text-red-700 w-full">{error}</p> : null}
    </div>
  );
}
