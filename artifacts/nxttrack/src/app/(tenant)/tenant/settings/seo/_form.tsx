"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  saveTenantSeoSettings,
  upsertPageSeo,
  deletePageSeo,
} from "@/lib/actions/tenant/seo";

interface Defaults {
  default_title: string;
  title_template: string;
  default_description: string;
  default_image_url: string;
  og_site_name: string;
  twitter_handle: string;
}

interface Override {
  id?: string;
  page_path: string;
  title: string;
  description: string;
  image_url: string;
  noindex: boolean;
}

interface Props {
  tenantId: string;
  defaults: Defaults;
  overrides: Override[];
}

const KNOWN_PATHS = [
  { path: "", label: "Home" },
  { path: "nieuws", label: "Nieuws (overzicht)" },
  { path: "schedule", label: "Agenda" },
  { path: "proefles", label: "Proefles" },
  { path: "inschrijven", label: "Inschrijven" },
];

export function TenantSeoForm({ tenantId, defaults: d0, overrides: o0 }: Props) {
  const [d, setD] = useState<Defaults>(d0);
  const [overrides, setOverrides] = useState<Override[]>(o0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function saveDefaults() {
    setMsg(null);
    start(async () => {
      const res = await saveTenantSeoSettings({
        tenant_id: tenantId,
        default_title: d.default_title,
        title_template: d.title_template,
        default_description: d.default_description,
        default_image_url: d.default_image_url,
        og_site_name: d.og_site_name,
        twitter_handle: d.twitter_handle,
      });
      setMsg(res.ok ? "Opgeslagen." : res.error);
    });
  }

  function addOverride() {
    setOverrides([
      ...overrides,
      { page_path: "", title: "", description: "", image_url: "", noindex: false },
    ]);
  }

  function updateOverride(idx: number, patch: Partial<Override>) {
    setOverrides((cur) => cur.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }

  function saveOverride(idx: number) {
    const o = overrides[idx];
    setMsg(null);
    start(async () => {
      const res = await upsertPageSeo({
        id: o.id,
        tenant_id: tenantId,
        page_path: o.page_path,
        title: o.title,
        description: o.description,
        image_url: o.image_url,
        noindex: o.noindex,
      });
      setMsg(res.ok ? "Pagina-SEO opgeslagen." : res.error);
    });
  }

  function removeOverride(idx: number) {
    const o = overrides[idx];
    if (!o.id) {
      setOverrides((cur) => cur.filter((_, i) => i !== idx));
      return;
    }
    if (!confirm(`Verwijder SEO voor "${o.page_path}"?`)) return;
    setMsg(null);
    start(async () => {
      const res = await deletePageSeo({ tenant_id: tenantId, id: o.id! });
      if (res.ok) setOverrides((cur) => cur.filter((_, i) => i !== idx));
      setMsg(res.ok ? "Verwijderd." : res.error);
    });
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          {msg}
        </div>
      )}

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Standaard
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Wordt op elke pagina gebruikt waar geen specifieke override bestaat.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Standaard titel">
            <input
              value={d.default_title}
              onChange={(e) => setD({ ...d, default_title: e.target.value })}
              placeholder="Bijv. Voetbalschool Houtrust"
              className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field
            label="Titel-template"
            hint="%s = paginatitel · %tenant% = clubnaam"
          >
            <input
              value={d.title_template}
              onChange={(e) => setD({ ...d, title_template: e.target.value })}
              placeholder="%s | %tenant%"
              className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field label="OG site-naam">
            <input
              value={d.og_site_name}
              onChange={(e) => setD({ ...d, og_site_name: e.target.value })}
              className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field label="Twitter handle (optioneel)">
            <input
              value={d.twitter_handle}
              onChange={(e) => setD({ ...d, twitter_handle: e.target.value })}
              placeholder="@voorbeeld"
              className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field label="Standaard omschrijving" full>
            <textarea
              value={d.default_description}
              onChange={(e) => setD({ ...d, default_description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-sm"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field label="Standaard deel-afbeelding (URL)" full>
            <input
              value={d.default_image_url}
              onChange={(e) => setD({ ...d, default_image_url: e.target.value })}
              placeholder="https://..."
              className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={saveDefaults}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--tenant-accent, #b6d83b)" }}
          >
            <Save className="h-3 w-3" /> Opslaan
          </button>
        </div>
      </section>

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Pagina-overrides
            </h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Wijk per pagina af. Pad is relatief aan <code>/t/{"{slug}"}/</code>
              — bijv. <code>nieuws</code> of leeg voor de homepage.
            </p>
          </div>
          <button
            type="button"
            onClick={addOverride}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            <Plus className="h-3 w-3" /> Toevoegen
          </button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Geen overrides. Voeg er één toe om af te wijken van je standaard.
          </p>
        ) : (
          <ul className="space-y-3">
            {overrides.map((o, idx) => (
              <li
                key={o.id ?? `new-${idx}`}
                className="rounded-xl border p-3"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Pagina-pad (na /t/{slug}/)">
                    <input
                      list={`paths-${idx}`}
                      value={o.page_path}
                      onChange={(e) => updateOverride(idx, { page_path: e.target.value })}
                      placeholder="bv. nieuws"
                      className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
                      style={{
                        borderColor: "var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <datalist id={`paths-${idx}`}>
                      {KNOWN_PATHS.map((p) => (
                        <option key={p.path} value={p.path}>
                          {p.label}
                        </option>
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Titel">
                    <input
                      value={o.title}
                      onChange={(e) => updateOverride(idx, { title: e.target.value })}
                      className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
                      style={{
                        borderColor: "var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </Field>
                  <Field label="Omschrijving" full>
                    <textarea
                      value={o.description}
                      onChange={(e) => updateOverride(idx, { description: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-sm"
                      style={{
                        borderColor: "var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </Field>
                  <Field label="Afbeelding (URL)" full>
                    <input
                      value={o.image_url}
                      onChange={(e) => updateOverride(idx, { image_url: e.target.value })}
                      placeholder="https://..."
                      className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
                      style={{
                        borderColor: "var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </Field>
                  <label className="col-span-full inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={o.noindex}
                      onChange={(e) => updateOverride(idx, { noindex: e.target.checked })}
                    />
                    <span style={{ color: "var(--text-primary)" }}>
                      Verberg voor zoekmachines (<code>noindex</code>)
                    </span>
                  </label>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => removeOverride(idx)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{ borderColor: "var(--surface-border)", color: "#b91c1c" }}
                  >
                    <Trash2 className="h-3 w-3" /> Verwijder
                  </button>
                  <button
                    type="button"
                    disabled={pending || !o.page_path && o.page_path !== ""}
                    onClick={() => saveOverride(idx)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: "var(--tenant-accent, #b6d83b)" }}
                  >
                    <Save className="h-3 w-3" /> Opslaan
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label
        className="mb-1 block text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
