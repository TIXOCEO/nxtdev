"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, Archive, EyeOff } from "lucide-react";
import {
  setProgramVisibility,
  updateProgram,
} from "@/lib/actions/tenant/programs";
import type { ProgramRow } from "@/lib/db/programs";

export function OverviewForm({
  tenantId,
  program,
}: {
  tenantId: string;
  program: ProgramRow;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visPending, startVisTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [name, setName] = useState(program.name);
  const [slug, setSlug] = useState(program.slug);
  const [publicSlug, setPublicSlug] = useState(program.public_slug ?? "");
  const [marketingTitle, setMarketingTitle] = useState(program.marketing_title ?? "");
  const [marketingDescription, setMarketingDescription] = useState(program.marketing_description ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(program.hero_image_url ?? "");
  const [ctaLabel, setCtaLabel] = useState(program.cta_label ?? "");
  const [defaultCapacity, setDefaultCapacity] = useState(
    program.default_capacity != null ? String(program.default_capacity) : "",
  );
  const [defaultFlexCapacity, setDefaultFlexCapacity] = useState(
    program.default_flex_capacity != null ? String(program.default_flex_capacity) : "",
  );
  const [defaultMinInstructors, setDefaultMinInstructors] = useState(
    String(program.default_min_instructors ?? 1),
  );
  const [ageMin, setAgeMin] = useState(program.age_min != null ? String(program.age_min) : "");
  const [ageMax, setAgeMax] = useState(program.age_max != null ? String(program.age_max) : "");
  const [sortOrder, setSortOrder] = useState(String(program.sort_order ?? 0));

  const inputCls =
    "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;
  const labelCls = "mb-1 block text-xs font-medium";
  const labelStyle = { color: "var(--text-secondary)" } as const;

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    startTransition(async () => {
      const res = await updateProgram({
        tenant_id: tenantId,
        id: program.id,
        name,
        slug,
        public_slug: publicSlug || null,
        marketing_title: marketingTitle || null,
        marketing_description: marketingDescription || null,
        hero_image_url: heroImageUrl || null,
        cta_label: ctaLabel || null,
        default_capacity: defaultCapacity || null,
        default_flex_capacity: defaultFlexCapacity || null,
        default_min_instructors: defaultMinInstructors,
        age_min: ageMin || null,
        age_max: ageMax || null,
        sort_order: sortOrder,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (!res.ok) { setErr(res.error); return; }
      setOk("Opgeslagen.");
      router.refresh();
    });
  }

  function changeVisibility(v: "public" | "internal" | "archived") {
    setErr(null);
    setOk(null);
    startVisTransition(async () => {
      const res = await setProgramVisibility({ tenant_id: tenantId, id: program.id, visibility: v });
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });
  }

  const isPublic = program.visibility === "public";

  return (
    <form onSubmit={onSave} className="grid gap-6">
      {/* Visibility-segmented */}
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Zichtbaarheid
        </h2>
        <p className="mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          Huidige status: <strong>{program.visibility}</strong>. Publiek vereist een gevulde publieke slug.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={visPending}
            onClick={() => changeVisibility("internal")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: program.visibility === "internal" ? "var(--accent)" : "transparent",
              color: "var(--text-primary)",
            }}
          >
            <EyeOff className="h-3.5 w-3.5" /> Intern
          </button>
          <button
            type="button"
            disabled={visPending || !publicSlug}
            onClick={() => changeVisibility("public")}
            title={!publicSlug ? "Vul eerst een publieke slug in." : undefined}
            className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: isPublic ? "var(--accent)" : "transparent",
              color: "var(--text-primary)",
            }}
          >
            <Eye className="h-3.5 w-3.5" /> Publiek
          </button>
          <button
            type="button"
            disabled={visPending}
            onClick={() => changeVisibility("archived")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: program.visibility === "archived" ? "var(--accent)" : "transparent",
              color: "var(--text-primary)",
            }}
          >
            <Archive className="h-3.5 w-3.5" /> Archief
          </button>
        </div>
      </section>

      {/* Basis */}
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Basis</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} style={labelStyle}>Naam *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Interne slug *</label>
            <input required value={slug} onChange={(e) => setSlug(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Publieke slug</label>
            <input value={publicSlug} onChange={(e) => setPublicSlug(e.target.value)}
              className={inputCls} style={inputStyle} placeholder="bv. abc-traject" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Sort-order</label>
            <input inputMode="numeric" value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value.replace(/[^0-9]/g, ""))}
              className={inputCls} style={inputStyle} />
          </div>
        </div>
      </section>

      {/* Capaciteit-defaults */}
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Capaciteit-defaults</h2>
        <p className="mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          Gelden als fallback wanneer een groep of sessie zelf geen waarde heeft.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} style={labelStyle}>Standaard-capaciteit</label>
            <input inputMode="numeric" value={defaultCapacity}
              onChange={(e) => setDefaultCapacity(e.target.value.replace(/[^0-9]/g, ""))}
              className={inputCls} style={inputStyle} placeholder="bv. 12" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Flex-capaciteit</label>
            <input inputMode="numeric" value={defaultFlexCapacity}
              onChange={(e) => setDefaultFlexCapacity(e.target.value.replace(/[^0-9]/g, ""))}
              className={inputCls} style={inputStyle} placeholder="bv. 2" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Minimum-instructeurs</label>
            <input inputMode="numeric" value={defaultMinInstructors}
              onChange={(e) => setDefaultMinInstructors(e.target.value.replace(/[^0-9]/g, ""))}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Min. leeftijd</label>
            <input inputMode="numeric" value={ageMin}
              onChange={(e) => setAgeMin(e.target.value.replace(/[^0-9]/g, ""))}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Max. leeftijd</label>
            <input inputMode="numeric" value={ageMax}
              onChange={(e) => setAgeMax(e.target.value.replace(/[^0-9]/g, ""))}
              className={inputCls} style={inputStyle} />
          </div>
        </div>
      </section>

      {/* Marketing-velden — alleen actief bij publiek */}
      <section
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
          opacity: isPublic ? 1 : 0.7,
        }}
      >
        <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Marketing-velden
        </h2>
        <p className="mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          {isPublic
            ? "Deze velden worden gebruikt op de publieke marketplace (volgt in een latere release)."
            : "Wordt zichtbaar zodra zichtbaarheid op publiek staat."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} style={labelStyle}>Marketing titel</label>
            <input value={marketingTitle} onChange={(e) => setMarketingTitle(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} style={labelStyle}>Marketing beschrijving</label>
            <textarea value={marketingDescription} onChange={(e) => setMarketingDescription(e.target.value)}
              rows={4}
              className="w-full rounded-xl border bg-transparent p-3 text-sm outline-none disabled:opacity-50"
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Hero-afbeelding URL</label>
            <input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)}
              className={inputCls} style={inputStyle} placeholder="https://…" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>CTA-label</label>
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)}
              className={inputCls} style={inputStyle} placeholder="bv. 'Direct aanmelden'" />
          </div>
        </div>
      </section>

      {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
      {ok && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{ok}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Save className="h-4 w-4" /> {pending ? "Bezig…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
