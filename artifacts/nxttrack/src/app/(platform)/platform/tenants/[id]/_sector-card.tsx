"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, Sparkles } from "lucide-react";
import {
  TERMINOLOGY_KEYS,
  TERMINOLOGY_KEY_LABELS,
} from "@/lib/terminology/labels";
import {
  setTenantSector,
  seedTenantHomepage,
} from "@/lib/actions/platform/sector-templates";
import { resolveTerminology } from "@/lib/terminology/merge";
import type { TerminologyKey } from "@/lib/terminology/types";

/**
 * UI-split (bewust): `TenantForm` kiest `sector_template_key` bij
 * tenant-aanmaak/edit (de "kale" FK op `tenants`). `SectorCard` is
 * de uitgebreide bewerker die de sector koppelt aan
 * `terminology_overrides` + de "Seed homepage uit sector"-actie. De
 * dropdown in TenantForm is daarom alleen voor de onboarding/edit-
 * flow van basisvelden; voor woordenschat + seeden gebruikt de
 * platform-admin SectorCard.
 */
export interface SectorCardProps {
  tenantId: string;
  initialSectorKey: string | null;
  initialOverrides: Record<string, string>;
  templates: {
    key: string;
    name: string;
    terminology_json: Record<string, string>;
  }[];
  genericTerminology: Record<string, string>;
}

export function SectorCard({
  tenantId,
  initialSectorKey,
  initialOverrides,
  templates,
  genericTerminology,
}: SectorCardProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sectorKey, setSectorKey] = useState<string>(initialSectorKey ?? "");
  const [overrides, setOverrides] = useState<Record<string, string>>({ ...initialOverrides });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seedPending, startSeed] = useTransition();

  const selectedTemplate = templates.find((t) => t.key === sectorKey) ?? null;

  // Onbewaarde wijzigingen: seed-knop leest server-side de persisted
  // tenant.sector_template_key, dus dirty UI-state mag niet seeden.
  const sectorDirty = (sectorKey || null) !== (initialSectorKey ?? null);

  function onSeedHomepage(force: boolean) {
    setErr(null);
    setMsg(null);
    startSeed(async () => {
      const res = await seedTenantHomepage({ tenant_id: tenantId, force });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      const { inserted, skipped, reason, error: seedErr, skips } = res.data;
      if (reason === "no_template") setErr("Geen sectortemplate gekoppeld.");
      else if (reason === "no_modules")
        setErr("Deze sectortemplate heeft geen standaardmodules.");
      else if (reason === "already_seeded")
        setErr(
          "Tenant heeft al modules — geen actie. Verwijder ze eerst handmatig als je opnieuw wilt seeden.",
        );
      else if (
        reason === "tenant_read_error" ||
        reason === "template_read_error" ||
        reason === "tenant_modules_count_error" ||
        reason === "catalog_read_error" ||
        reason === "invalid_template_modules"
      )
        setErr(`Seed mislukt (${reason}): ${seedErr ?? "onbekende fout"}`);
      else {
        const skipDetail =
          skips && skips.length > 0
            ? ` Overgeslagen: ${skips
                .map((s) => `${s.module_key} (${s.reason})`)
                .join(", ")}.`
            : "";
        setMsg(
          `Seed voltooid: ${inserted} module(s) toegevoegd${skipped > 0 ? `, ${skipped} overgeslagen` : ""}.${skipDetail}`,
        );
      }
      router.refresh();
    });
  }

  // Effectief = generic ← sector ← overrides — gebruikt voor placeholders & preview.
  const effective = resolveTerminology({
    generic: genericTerminology,
    sector: selectedTemplate?.terminology_json,
    overrides,
  });
  const inheritedBase = resolveTerminology({
    generic: genericTerminology,
    sector: selectedTemplate?.terminology_json,
  });

  function onSave() {
    setErr(null);
    setMsg(null);
    const cleaned: Record<string, string> = {};
    for (const k of TERMINOLOGY_KEYS) {
      const v = overrides[k];
      if (typeof v === "string" && v.trim().length > 0) cleaned[k] = v.trim();
    }
    start(async () => {
      const res = await setTenantSector({
        tenant_id: tenantId,
        sector_template_key: sectorKey ? sectorKey : null,
        terminology_overrides: cleaned,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Sector & woordenschat opgeslagen.");
      setOverrides(cleaned);
      router.refresh();
    });
  }

  function onResetOverrides() {
    setOverrides({});
  }

  return (
    <div
      className="space-y-5 rounded-2xl border p-6"
      style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sectortemplate">
          <select
            value={sectorKey}
            onChange={(e) => setSectorKey(e.target.value)}
            className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            <option value="">— Geen (generic fallback) —</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} ({t.key})
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end justify-end">
          <button
            type="button"
            onClick={onResetOverrides}
            disabled={pending || Object.keys(overrides).length === 0}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          >
            <RotateCcw className="h-3 w-3" /> Wis overrides
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Per-tenant overrides
        </p>
        <p className="mb-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Lege velden gebruiken de waarde van de gekozen template. De preview rechts toont de uiteindelijke tekst.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TERMINOLOGY_KEYS.map((k: TerminologyKey) => (
            <Field key={k} label={TERMINOLOGY_KEY_LABELS[k]}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <input
                  value={overrides[k] ?? ""}
                  placeholder={inheritedBase[k]}
                  onChange={(e) => setOverrides({ ...overrides, [k]: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
                <span
                  className="truncate text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                  title={effective[k]}
                >
                  → {effective[k]}
                </span>
              </div>
            </Field>
          ))}
        </div>
      </div>

      {(msg || err) && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={
            err
              ? { borderColor: "rgb(252 165 165)", backgroundColor: "rgb(254 242 242)", color: "rgb(153 27 27)" }
              : { borderColor: "rgb(167 243 208)", backgroundColor: "rgb(236 253 245)", color: "rgb(6 95 70)" }
          }
        >
          {err ?? msg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSeedHomepage(false)}
            disabled={seedPending || pending || !sectorKey || sectorDirty}
            title={
              !sectorKey
                ? "Kies eerst een sectortemplate."
                : sectorDirty
                  ? "Sla de sectorwijziging eerst op voordat je seedt."
                  : "Voegt de standaardmodules van de gekozen sector toe als de tenant nog geen homepage-modules heeft."
            }
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          >
            <Sparkles className="h-3 w-3" />
            {seedPending
              ? "Bezig…"
              : sectorDirty
                ? "Sla eerst op om te seeden"
                : "Seed homepage uit sector"}
          </button>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Save className="h-3.5 w-3.5" /> {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        className="mb-1 block text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
