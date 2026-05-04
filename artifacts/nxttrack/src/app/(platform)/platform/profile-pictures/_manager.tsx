"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createPlatformTemplate,
  deletePlatformTemplate,
} from "@/lib/actions/platform/profile-pictures";
import type { ProfilePictureTemplate } from "@/types/database";

export interface PlatformProfilePicturesManagerProps {
  templates: ProfilePictureTemplate[];
}

export function PlatformProfilePicturesManager({
  templates,
}: PlatformProfilePicturesManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function add() {
    setErr(null);
    startTransition(async () => {
      const res = await createPlatformTemplate({ name, image_url: url });
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
      const res = await deletePlatformTemplate({ template_id: id });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
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
    <section
      className="rounded-2xl border p-4 sm:p-6"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
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
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {templates.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border p-2"
              style={{ borderColor: "var(--surface-border)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.image_url} alt={t.name} className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
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
  );
}
