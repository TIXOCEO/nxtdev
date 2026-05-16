"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIntakeForm } from "@/lib/actions/tenant/intake-forms";

export function IntakeFormCreateButton({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createIntakeForm({
        tenant_id: tenantId,
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: name.trim(),
        submission_type: "trial_lesson",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setName("");
      setSlug("");
      router.push(`/tenant/intake/forms/${res.data.form_id}/builder`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-3 py-1.5 text-sm font-medium"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground, white)",
        }}
      >
        Nieuw formulier
      </button>
    );
  }

  return (
    <div
      className="flex flex-wrap items-end gap-2 rounded-md p-3"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
    >
      <label className="flex flex-col text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Naam</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
          placeholder="Bv. Proefles standaard"
        />
      </label>
      <label className="flex flex-col text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Slug (optioneel)</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="mt-1 rounded-md border px-2 py-1 text-sm font-mono"
          style={{ borderColor: "var(--border)" }}
          placeholder="auto"
        />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending || !name.trim()}
        className="rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground, white)",
        }}
      >
        {pending ? "Bezig…" : "Aanmaken"}
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
