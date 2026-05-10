"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createProgram } from "@/lib/actions/tenant/programs";
import { VISIBILITY_VALUES, type ProgramVisibility } from "@/lib/validation/programs";

const VISIBILITY_LABELS: Record<ProgramVisibility, string> = {
  internal: "Intern (alleen tenant-admins)",
  public: "Publiek (zichtbaar op marketplace)",
  archived: "Archief",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function NewProgramForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [visibility, setVisibility] = useState<ProgramVisibility>("internal");
  const [publicSlug, setPublicSlug] = useState("");
  const [defaultCapacity, setDefaultCapacity] = useState("");
  const [defaultFlexCapacity, setDefaultFlexCapacity] = useState("");
  const [defaultMinInstructors, setDefaultMinInstructors] = useState("1");

  const inputCls =
    "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;
  const labelCls = "mb-1 block text-xs font-medium";
  const labelStyle = { color: "var(--text-secondary)" } as const;

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      const res = await createProgram({
        tenant_id: tenantId,
        name,
        slug,
        visibility,
        public_slug: visibility === "public" ? (publicSlug || null) : (publicSlug || null),
        default_capacity: defaultCapacity || null,
        default_flex_capacity: defaultFlexCapacity || null,
        default_min_instructors: defaultMinInstructors,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push(`/tenant/programmas/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <label className={labelCls} style={labelStyle}>Naam *</label>
        <input
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={inputCls}
          style={inputStyle}
          placeholder="Bijv. ABC-zwemtraject"
        />
      </div>

      <div>
        <label className={labelCls} style={labelStyle}>Interne slug *</label>
        <input
          required
          value={slug}
          onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
          className={inputCls}
          style={inputStyle}
          placeholder="abc-zwemtraject"
        />
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Alleen kleine letters, cijfers en koppelteken. Wordt gebruikt voor interne verwijzingen.
        </p>
      </div>

      <div>
        <label className={labelCls} style={labelStyle}>Zichtbaarheid</label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as ProgramVisibility)}
          className={inputCls}
          style={inputStyle}
        >
          {VISIBILITY_VALUES.map((v) => (
            <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {visibility === "public" && (
        <div className="sm:col-span-2">
          <label className={labelCls} style={labelStyle}>Publieke slug *</label>
          <input
            required
            value={publicSlug}
            onChange={(e) => setPublicSlug(slugify(e.target.value))}
            className={inputCls}
            style={inputStyle}
            placeholder="abc-traject"
          />
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            URL-segment voor de publieke marketplace (volgt in latere release).
          </p>
        </div>
      )}

      <div>
        <label className={labelCls} style={labelStyle}>Standaard-capaciteit</label>
        <input
          inputMode="numeric"
          value={defaultCapacity}
          onChange={(e) => setDefaultCapacity(e.target.value.replace(/[^0-9]/g, ""))}
          className={inputCls}
          style={inputStyle}
          placeholder="bv. 12"
        />
      </div>

      <div>
        <label className={labelCls} style={labelStyle}>Flex-capaciteit (boven standaard)</label>
        <input
          inputMode="numeric"
          value={defaultFlexCapacity}
          onChange={(e) => setDefaultFlexCapacity(e.target.value.replace(/[^0-9]/g, ""))}
          className={inputCls}
          style={inputStyle}
          placeholder="bv. 2"
        />
      </div>

      <div>
        <label className={labelCls} style={labelStyle}>Minimum-instructeurs</label>
        <input
          inputMode="numeric"
          value={defaultMinInstructors}
          onChange={(e) => setDefaultMinInstructors(e.target.value.replace(/[^0-9]/g, ""))}
          className={inputCls}
          style={inputStyle}
          placeholder="1"
        />
      </div>

      {err && (
        <p className="sm:col-span-2 text-xs text-red-600" role="alert">{err}</p>
      )}

      <div className="sm:col-span-2 flex justify-end">
        <button
          type="submit"
          disabled={pending || !name.trim() || !slug.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" /> {pending ? "Bezig…" : "Aanmaken"}
        </button>
      </div>
    </form>
  );
}
