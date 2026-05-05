"use client";

import { useRef, useState, useTransition } from "react";
import { Save, Upload, X, Image as ImageIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { updateTenantModuleConfig } from "@/lib/actions/tenant/homepage";
import { uploadHomepageImage } from "@/lib/actions/tenant/homepage-uploads";
import type { TenantModule } from "@/types/database";

const RichTextEditor = dynamic(
  () => import("@/components/editor/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false },
);

export interface PageOption {
  /** Pad relatief aan tenant-root (bv. "nieuws", "info/contact"). */
  path: string;
  title: string;
}

interface Props {
  tenantId: string;
  module: TenantModule;
  pages?: PageOption[];
  onSaved?: () => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
} as const;

export function ModuleConfigEditor({ tenantId, module, pages = [], onSaved }: Props) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    module.config ?? {},
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends string>(key: K, value: unknown) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateTenantModuleConfig({
        tenant_id: tenantId,
        module_id: module.id,
        config,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved?.();
    });
  }

  const k = module.module_key;

  return (
    <div className="space-y-3">
      {k === "hero_slider" && (
        <HeroSliderEditor
          tenantId={tenantId}
          config={config}
          set={set}
          pages={pages}
        />
      )}
      {k === "news_hero_slider" && <NewsHeroSliderEditor config={config} set={set} />}
      {k === "news" && <NewsEditor config={config} set={set} />}
      {k === "custom_content" && <CustomContentEditor config={config} set={set} />}
      {k === "video" && <VideoEditor config={config} set={set} />}
      {k === "cta" && <CtaEditor config={config} set={set} pages={pages} />}
      {k === "sponsors" && <SponsorsEditor config={config} set={set} />}
      {k === "events_trainings" && <EventsEditor config={config} set={set} />}
      {k === "media_wall" && <MediaWallEditor config={config} set={set} />}
      {k === "personal_dashboard" && <PersonalDashboardEditor config={config} set={set} />}
      {k === "alerts_announcements" && <AlertsEditor config={config} set={set} />}
      {k === "trainers" && <TrainersEditor config={config} set={set} />}
      {k === "social_feed" && <SocialFeedEditor config={config} set={set} />}

      {error && (
        <p className="text-xs" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Save className="h-3 w-3" />
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

type SetFn = (k: string, v: unknown) => void;
interface CfgProps {
  config: Record<string, unknown>;
  set: SetFn;
}

// ─── Page picker (interne pagina's + handmatige URL) ────────────────────
function PageOrUrlPicker({
  value,
  onChange,
  pages,
}: {
  value: string;
  onChange: (v: string) => void;
  pages: PageOption[];
}) {
  // Lege select-waarde betekent: gebruiker typt eigen URL.
  const matchedPath = pages.find((p) => p.path === value)?.path ?? "";
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="block">
        <span
          className="mb-1 block text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Interne pagina
        </span>
        <select
          value={matchedPath}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="">— Geen / handmatige URL —</option>
          {pages.map((p) => (
            <option key={p.path} value={p.path}>
              {p.title} ({p.path})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span
          className="mb-1 block text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Of vrije URL
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="bv. /nieuws of https://…"
          className={inputClass}
          style={inputStyle}
        />
      </label>
    </div>
  );
}

// ─── Image upload veld ───────────────────────────────────────────────────
function ImageUploadField({
  tenantId,
  value,
  onChange,
}: {
  tenantId: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("tenant_id", tenantId);
      fd.append("file", file);
      const res = await uploadHomepageImage(fd);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      onChange(res.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-16 w-24 rounded-lg border object-cover"
            style={{ borderColor: "var(--surface-border)" }}
          />
        ) : (
          <div
            className="flex h-16 w-24 items-center justify-center rounded-lg border"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-secondary)",
            }}
          >
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1.5">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            <Upload className="h-3 w-3" />
            {uploading ? "Uploaden…" : value ? "Vervangen" : "Achtergrond uploaden"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 self-start text-[11px] font-semibold"
              style={{ color: "#dc2626" }}
            >
              <X className="h-3 w-3" /> Verwijderen
            </button>
          )}
          {err && <p className="text-[11px]" style={{ color: "#dc2626" }}>{err}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

interface HeroSlideShape {
  title?: string;
  subtitle?: string;
  body?: string;
  cta_label?: string;
  cta_url?: string;
  background_image_url?: string;
}

function HeroSliderEditor({
  tenantId,
  config,
  set,
  pages,
}: CfgProps & { tenantId: string; pages: PageOption[] }) {
  const slides = (config.slides as HeroSlideShape[] | undefined) ?? [];
  function updateSlide(i: number, patch: Partial<HeroSlideShape>) {
    const next = [...slides];
    next[i] = { ...(next[i] ?? {}), ...patch };
    set("slides", next);
  }
  function addSlide() {
    set("slides", [
      ...slides,
      {
        title: "",
        subtitle: "",
        body: "",
        cta_label: "",
        cta_url: "",
        background_image_url: "",
      },
    ]);
  }
  function removeSlide(i: number) {
    set("slides", slides.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={(config.autoplay as boolean) ?? true}
          onChange={(e) => set("autoplay", e.target.checked)}
        />
        <span style={{ color: "var(--text-primary)" }}>Automatisch doorbladeren</span>
      </label>

      <div className="space-y-2">
        {slides.map((s, i) => (
          <div
            key={i}
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <p
              className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              Slide {i + 1}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Subtitel (label boven titel)"
                value={s.subtitle ?? ""}
                onChange={(e) => updateSlide(i, { subtitle: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
              <input
                placeholder="Titel"
                value={s.title ?? ""}
                onChange={(e) => updateSlide(i, { title: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <textarea
              placeholder="Tekst"
              value={s.body ?? ""}
              onChange={(e) => updateSlide(i, { body: e.target.value })}
              className={`${inputClass} mt-2`}
              style={inputStyle}
              rows={2}
            />

            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                placeholder="Knop label (bv. Lees meer)"
                value={s.cta_label ?? ""}
                onChange={(e) => updateSlide(i, { cta_label: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
              <input
                placeholder="Knop URL"
                value={s.cta_url ?? ""}
                onChange={(e) => updateSlide(i, { cta_url: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            {pages.length > 0 && (
              <div className="mt-2">
                <PageOrUrlPicker
                  value={s.cta_url ?? ""}
                  onChange={(v) => updateSlide(i, { cta_url: v })}
                  pages={pages}
                />
              </div>
            )}

            <div className="mt-3">
              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Achtergrondafbeelding (optioneel)
              </p>
              <ImageUploadField
                tenantId={tenantId}
                value={s.background_image_url ?? ""}
                onChange={(url) => updateSlide(i, { background_image_url: url })}
              />
              <p className="mt-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                Met afbeelding: tekst wordt licht en krijgt een donkere overlay.
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeSlide(i)}
              className="mt-3 text-[11px] font-semibold"
              style={{ color: "#dc2626" }}
            >
              Verwijder slide
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSlide}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        >
          + Slide toevoegen
        </button>
      </div>
    </div>
  );
}

function NewsHeroSliderEditor({ config, set }: CfgProps) {
  return (
    <div className="space-y-2">
      <Field label="Aantal nieuwsslides">
        <input
          type="number"
          min={1}
          max={10}
          value={(config.limit as number) ?? 5}
          onChange={(e) => set("limit", Number(e.target.value))}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={(config.autoplay as boolean) ?? true}
          onChange={(e) => set("autoplay", e.target.checked)}
        />
        <span style={{ color: "var(--text-primary)" }}>Automatisch doorbladeren</span>
      </label>
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Slides worden automatisch opgebouwd uit de laatste nieuwsberichten.
        Voeg een omslagfoto toe in de nieuwseditor om de achtergrond te zetten.
      </p>
    </div>
  );
}

function NewsEditor({ config, set }: CfgProps) {
  return (
    <div className="space-y-2">
      <Field label="Aantal berichten">
        <input
          type="number"
          min={1}
          max={20}
          value={(config.limit as number) ?? 3}
          onChange={(e) => set("limit", Number(e.target.value))}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={(config.highlight_latest as boolean) ?? true}
          onChange={(e) => set("highlight_latest", e.target.checked)}
        />
        <span style={{ color: "var(--text-primary)" }}>Markeer laatste bericht</span>
      </label>
    </div>
  );
}

function CustomContentEditor({ config, set }: CfgProps) {
  return (
    <Field label="Inhoud">
      <RichTextEditor
        value={(config.content_html as string) ?? ""}
        onChange={(html) => set("content_html", html)}
        minHeight={140}
      />
    </Field>
  );
}

function VideoEditor({ config, set }: CfgProps) {
  return (
    <div className="space-y-2">
      <Field label="Provider">
        <select
          value={(config.provider as string) ?? "youtube"}
          onChange={(e) => set("provider", e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
        </select>
      </Field>
      <Field label="Video URL">
        <input
          type="url"
          value={(config.video_url as string) ?? ""}
          onChange={(e) => set("video_url", e.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          className={inputClass}
          style={inputStyle}
        />
      </Field>
    </div>
  );
}

function CtaEditor({ config, set, pages }: CfgProps & { pages: PageOption[] }) {
  return (
    <div className="space-y-2">
      <Field label="Tekst">
        <textarea
          value={(config.text as string) ?? ""}
          onChange={(e) => set("text", e.target.value)}
          rows={3}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <Field label="Knop label">
        <input
          value={(config.button_label as string) ?? ""}
          onChange={(e) => set("button_label", e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <Field label="Knop link">
        {pages.length > 0 ? (
          <PageOrUrlPicker
            value={(config.button_url as string) ?? ""}
            onChange={(v) => set("button_url", v)}
            pages={pages}
          />
        ) : (
          <input
            value={(config.button_url as string) ?? ""}
            onChange={(e) => set("button_url", e.target.value)}
            placeholder="bv. /nieuws of https://…"
            className={inputClass}
            style={inputStyle}
          />
        )}
      </Field>
    </div>
  );
}

function SponsorsEditor({ config, set }: CfgProps) {
  return (
    <div className="space-y-2">
      <Field label="Weergave">
        <select
          value={(config.display_mode as string) ?? "grid"}
          onChange={(e) => set("display_mode", e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="grid">Raster</option>
          <option value="carousel">Carrousel</option>
        </select>
      </Field>
      <Field label="Maximaal aantal">
        <input
          type="number"
          min={1}
          max={48}
          value={(config.limit as number) ?? 12}
          onChange={(e) => set("limit", Number(e.target.value))}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Beheer sponsoren via <strong>Sponsoren</strong> in het zijmenu.
      </p>
    </div>
  );
}

function EventsEditor({ config, set }: CfgProps) {
  return (
    <div className="space-y-2">
      <Field label="Aantal">
        <input
          type="number"
          min={1}
          max={20}
          value={(config.limit as number) ?? 5}
          onChange={(e) => set("limit", Number(e.target.value))}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={(config.show_attendance_status as boolean) ?? false}
          onChange={(e) => set("show_attendance_status", e.target.checked)}
        />
        <span style={{ color: "var(--text-primary)" }}>Toon aanwezigheidsstatus</span>
      </label>
    </div>
  );
}

function MediaWallEditor({ config, set }: CfgProps) {
  return (
    <div className="space-y-2">
      <Field label="Weergave">
        <select
          value={(config.display_mode as string) ?? "grid"}
          onChange={(e) => set("display_mode", e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="grid">Raster</option>
          <option value="carousel">Carrousel</option>
        </select>
      </Field>
      <Field label="Maximaal aantal">
        <input
          type="number"
          min={1}
          max={48}
          value={(config.limit as number) ?? 9}
          onChange={(e) => set("limit", Number(e.target.value))}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Beheer media via <strong>Media Wall</strong> in het zijmenu.
      </p>
    </div>
  );
}

function PersonalDashboardEditor({ config, set }: CfgProps) {
  const Toggle = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={(config[k] as boolean) ?? true}
        onChange={(e) => set(k, e.target.checked)}
      />
      <span style={{ color: "var(--text-primary)" }}>{label}</span>
    </label>
  );
  return (
    <div className="space-y-2">
      <Toggle k="show_next_training" label="Volgende training tonen" />
      <Toggle k="show_latest_notifications" label="Recente meldingen tonen" />
      <Toggle k="show_quick_actions" label="Snelkoppelingen tonen" />
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Deze module is altijd alleen zichtbaar voor ingelogde gebruikers.
      </p>
    </div>
  );
}

function AlertsEditor({ config, set }: CfgProps) {
  const Toggle = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={(config[k] as boolean) ?? true}
        onChange={(e) => set(k, e.target.checked)}
      />
      <span style={{ color: "var(--text-primary)" }}>{label}</span>
    </label>
  );
  return (
    <div className="space-y-2">
      <Toggle k="show_alerts" label="Alerts tonen" />
      <Toggle k="show_announcements" label="Aankondigingen tonen" />
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Beheer items via <strong>Communicatie → Alerts</strong>.
      </p>
    </div>
  );
}

function SocialFeedEditor({ config, set }: CfgProps) {
  return (
    <div className="space-y-2">
      <Field label="Maximaal aantal berichten">
        <input
          type="number"
          min={1}
          max={20}
          value={(config.limit as number) ?? 5}
          onChange={(e) => set("limit", Number(e.target.value))}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <Field label="Filter">
        <select
          value={(config.filter as string) ?? "all"}
          onChange={(e) => set("filter", e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="all">Alle</option>
          <option value="team">Alleen team posts</option>
          <option value="coach">Alleen coach broadcasts</option>
          <option value="achievements">Alleen prestaties</option>
        </select>
      </Field>
    </div>
  );
}

function TrainersEditor({ config, set }: CfgProps) {
  return (
    <div className="space-y-2">
      <Field label="Maximaal aantal">
        <input
          type="number"
          min={1}
          max={48}
          value={(config.limit as number) ?? 8}
          onChange={(e) => set("limit", Number(e.target.value))}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={(config.show_bio as boolean) ?? true}
          onChange={(e) => set("show_bio", e.target.checked)}
        />
        <span style={{ color: "var(--text-primary)" }}>Bio tonen</span>
      </label>
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Trainers verschijnen alleen als <strong>show_in_public</strong> aan staat
        (in het lid-detail).
      </p>
    </div>
  );
}
