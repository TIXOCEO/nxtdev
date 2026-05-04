"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import dynamic from "next/dynamic";
import { updateTenantModuleConfig } from "@/lib/actions/tenant/homepage";
import type { TenantModule } from "@/types/database";

const RichTextEditor = dynamic(
  () => import("@/components/editor/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false },
);

interface Props {
  tenantId: string;
  module: TenantModule;
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

export function ModuleConfigEditor({ tenantId, module, onSaved }: Props) {
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
      {k === "hero_slider" && <HeroSliderEditor config={config} set={set} />}
      {k === "news" && <NewsEditor config={config} set={set} />}
      {k === "custom_content" && (
        <CustomContentEditor config={config} set={set} />
      )}
      {k === "video" && <VideoEditor config={config} set={set} />}
      {k === "cta" && <CtaEditor config={config} set={set} />}
      {k === "sponsors" && <SponsorsEditor config={config} set={set} />}
      {k === "events_trainings" && (
        <EventsEditor config={config} set={set} />
      )}
      {k === "media_wall" && <MediaWallEditor config={config} set={set} />}
      {k === "personal_dashboard" && (
        <PersonalDashboardEditor config={config} set={set} />
      )}
      {k === "alerts_announcements" && (
        <AlertsEditor config={config} set={set} />
      )}
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

function HeroSliderEditor({ config, set }: CfgProps) {
  const slides = (config.slides as Array<Record<string, string>>) ?? [];
  function updateSlide(i: number, key: string, value: string) {
    const next = [...slides];
    next[i] = { ...(next[i] ?? {}), [key]: value };
    set("slides", next);
  }
  function addSlide() {
    set("slides", [...slides, { title: "", subtitle: "", body: "", cta_label: "", cta_url: "" }]);
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
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Titel"
                value={s.title ?? ""}
                onChange={(e) => updateSlide(i, "title", e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
              <input
                placeholder="Subtitel"
                value={s.subtitle ?? ""}
                onChange={(e) => updateSlide(i, "subtitle", e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
              <input
                placeholder="Knop label"
                value={s.cta_label ?? ""}
                onChange={(e) => updateSlide(i, "cta_label", e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
              <input
                placeholder="Knop URL"
                value={s.cta_url ?? ""}
                onChange={(e) => updateSlide(i, "cta_url", e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <textarea
              placeholder="Tekst"
              value={s.body ?? ""}
              onChange={(e) => updateSlide(i, "body", e.target.value)}
              className={`${inputClass} mt-2`}
              style={inputStyle}
              rows={2}
            />
            <button
              type="button"
              onClick={() => removeSlide(i)}
              className="mt-2 text-[11px] font-semibold"
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

function CtaEditor({ config, set }: CfgProps) {
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
      <Field label="Knop URL">
        <input
          value={(config.button_url as string) ?? ""}
          onChange={(e) => set("button_url", e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
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
