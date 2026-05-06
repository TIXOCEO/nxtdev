"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  RELEASE_STATUSES,
  RELEASE_TYPES,
  type ReleaseBody,
  type ReleaseStatus,
  type ReleaseType,
} from "@/lib/validation/release";
import {
  createRelease,
  updateRelease,
  deleteRelease,
} from "@/lib/actions/platform/releases";
import type { PlatformRelease } from "@/lib/db/releases";

type SectionKey = keyof ReleaseBody;

const SECTION_LABEL: Record<SectionKey, string> = {
  new: "Nieuw",
  improved: "Verbeterd",
  fixed: "Opgelost",
  admin: "Voor admins",
};

const SECTION_ORDER: SectionKey[] = ["new", "improved", "fixed", "admin"];

function defaultBody(): ReleaseBody {
  return { new: [], improved: [], fixed: [], admin: [] };
}

function toIsoDateInput(iso: string | null): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return new Date(iso).toISOString().slice(0, 10);
}

export interface ReleaseFormProps {
  mode: "create" | "edit";
  initial?: PlatformRelease;
}

export function ReleaseForm({ mode, initial }: ReleaseFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [version, setVersion] = useState(initial?.version ?? "");
  const [releaseType, setReleaseType] = useState<ReleaseType>(initial?.release_type ?? "minor");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [status, setStatus] = useState<ReleaseStatus>(initial?.status ?? "draft");
  const [publishedAt, setPublishedAt] = useState(toIsoDateInput(initial?.published_at ?? null));
  const [body, setBody] = useState<ReleaseBody>(initial?.body_json ?? defaultBody());

  const sectionHint = useMemo(() => {
    if (releaseType === "major") return "Major: vul alle vier de secties met meerdere bullets en expliciete impact.";
    if (releaseType === "minor") return "Minor: 2–3 secties met beknopte bullets.";
    return "Patch: meestal 1 sectie (Opgelost of Verbeterd) met 1–2 regels.";
  }, [releaseType]);

  function setSection(key: SectionKey, items: string[]) {
    setBody((b) => ({ ...b, [key]: items }));
  }

  function addBullet(key: SectionKey) {
    setSection(key, [...body[key], ""]);
  }

  function removeBullet(key: SectionKey, idx: number) {
    setSection(key, body[key].filter((_, i) => i !== idx));
  }

  function updateBullet(key: SectionKey, idx: number, value: string) {
    setSection(key, body[key].map((v, i) => (i === idx ? value : v)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    // Strip lege bullets.
    const cleanedBody: ReleaseBody = {
      new: body.new.map((s) => s.trim()).filter(Boolean),
      improved: body.improved.map((s) => s.trim()).filter(Boolean),
      fixed: body.fixed.map((s) => s.trim()).filter(Boolean),
      admin: body.admin.map((s) => s.trim()).filter(Boolean),
    };

    startTransition(async () => {
      const payload = {
        version: version.trim(),
        release_type: releaseType,
        title: title.trim(),
        summary: summary.trim(),
        body: cleanedBody,
        status,
        published_at: publishedAt,
      };
      const res =
        mode === "create"
          ? await createRelease(payload)
          : await updateRelease({ ...payload, id: initial!.id });

      if (!res.ok) {
        setServerError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      router.push("/platform/releases");
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial) return;
    if (!confirm(`Release v${initial.version} echt verwijderen?`)) return;
    startTransition(async () => {
      const res = await deleteRelease(initial.id);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/platform/releases");
      router.refresh();
    });
  }

  const fieldErr = (k: string) => fieldErrors[k]?.[0];

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {serverError && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "#fca5a5", backgroundColor: "#fee2e2", color: "#991b1b" }}
        >
          {serverError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Versie (semver)" error={fieldErr("version")} hint="bv. 1.0.0">
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="0.10.0"
            className="w-full rounded-xl border px-3 py-2 font-mono text-sm"
            style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
            required
          />
        </Field>

        <Field label="Type" error={fieldErr("release_type")}>
          <select
            value={releaseType}
            onChange={(e) => setReleaseType(e.target.value as ReleaseType)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
          >
            {RELEASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Publicatiedatum" error={fieldErr("published_at")}>
          <input
            type="date"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
            required
          />
        </Field>

        <Field label="Status" error={fieldErr("status")}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReleaseStatus)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
          >
            {RELEASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "draft" ? "Concept" : s === "published" ? "Gepubliceerd" : "Gearchiveerd"}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Titel" error={fieldErr("title")}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Korte kop"
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
          required
        />
      </Field>

      <Field
        label="Samenvatting (1–2 zinnen, gebruikt op het dashboard)"
        error={fieldErr("summary")}
      >
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          maxLength={400}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
          required
        />
      </Field>

      <div className="space-y-4">
        <div
          className="rounded-xl border px-4 py-3 text-xs"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--surface-soft)",
            color: "var(--text-secondary)",
          }}
        >
          <strong style={{ color: "var(--text-primary)" }}>Standaardformat:</strong> {sectionHint}
        </div>

        {SECTION_ORDER.map((key) => (
          <SectionEditor
            key={key}
            label={SECTION_LABEL[key]}
            items={body[key]}
            onAdd={() => addBullet(key)}
            onRemove={(i) => removeBullet(key, i)}
            onUpdate={(i, v) => updateBullet(key, i, v)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          {mode === "edit" && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium"
              style={{ borderColor: "#fca5a5", color: "#991b1b" }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Verwijder release
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          {pending ? "Opslaan..." : mode === "create" ? "Release aanmaken" : "Wijzigingen opslaan"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </span>
      )}
      {error && <span className="block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

function SectionEditor({
  label,
  items,
  onAdd,
  onRemove,
  onUpdate,
}: {
  label: string;
  items: string[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, v: string) => void;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {label}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-medium hover:underline"
          style={{ color: "var(--text-secondary)" }}
        >
          + bullet
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Geen bullets — leeg laten als deze sectie niet van toepassing is.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2">
              <input
                value={it}
                onChange={(e) => onUpdate(i, e.target.value)}
                placeholder="Beschrijf de wijziging..."
                className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: "var(--surface-soft)",
                }}
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 rounded-lg p-1.5 text-xs hover:bg-black/5"
                style={{ color: "var(--text-secondary)" }}
                aria-label="Verwijderen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
