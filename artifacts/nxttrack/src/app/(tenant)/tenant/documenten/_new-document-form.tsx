"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrainerDocument } from "@/lib/actions/tenant/trainer-documents";

const CATEGORIES = [
  { v: "handleiding", l: "Handleiding" },
  { v: "protocol", l: "Protocol" },
  { v: "formulier", l: "Formulier" },
  { v: "overig", l: "Overig" },
] as const;

export function NewDocumentForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["v"]>("overig");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createTrainerDocument(tenantId, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        file_url: fileUrl.trim(),
        file_type: fileType.trim() ? fileType.trim() : null,
        category,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTitle("");
      setDescription("");
      setFileUrl("");
      setFileType("");
      setCategory("overig");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border p-4"
      style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-card)" }}
    >
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Nieuw document
      </h3>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Titel</span>
        <input
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Beschrijving (optioneel)</span>
        <textarea
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Bestands-URL of pad</span>
        <input
          required
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://… of /uploads/…"
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Type (bv. PDF)</span>
          <input
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            maxLength={80}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Categorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number]["v"])}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.v} value={c.v}>
                {c.l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}

      <button
        type="submit"
        disabled={pending || !title.trim() || !fileUrl.trim()}
        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        {pending ? "Bezig…" : "Document toevoegen"}
      </button>
    </form>
  );
}
