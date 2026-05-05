"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ModuleCatalog, ModuleSize } from "@/types/database";

export const FULL_BLEED_KEYS = new Set(["hero_slider", "news_hero_slider"]);

interface Props {
  catalog: ModuleCatalog[];
  pending?: boolean;
  onClose: () => void;
  onAdd: (moduleKey: string, size: ModuleSize) => void;
}

const SIZE_OPTIONS: Array<{ value: ModuleSize; label: string; hint: string }> = [
  { value: "1x1", label: "1×1", hint: "halve breedte" },
  { value: "1x2", label: "1×2", hint: "half × dubbele hoogte" },
  { value: "2x1", label: "2×1", hint: "volle breedte" },
  { value: "2x2", label: "2×2", hint: "vol × dubbele hoogte" },
];

/**
 * Sprint 22 — Eerst module kiezen, dan grootte, dan toevoegen.
 * Hero-sliders forceren 2x1.
 */
export function ModuleAddDialog({ catalog, pending = false, onClose, onAdd }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [size, setSize] = useState<ModuleSize>("1x1");

  const isFullBleed = selectedKey ? FULL_BLEED_KEYS.has(selectedKey) : false;
  const effectiveSize: ModuleSize = isFullBleed ? "2x1" : size;

  function selectModule(key: string) {
    setSelectedKey(key);
    if (FULL_BLEED_KEYS.has(key)) setSize("2x1");
  }

  function confirm() {
    if (!selectedKey) return;
    onAdd(selectedKey, effectiveSize);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="flex w-full max-w-2xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Module toevoegen
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-black/5"
            style={{ color: "var(--text-secondary)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              1. Kies een module
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {catalog.map((c) => {
                const active = selectedKey === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => selectModule(c.key)}
                    className="rounded-lg border px-3 py-2 text-left text-xs"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--surface-border)",
                      backgroundColor: active ? "var(--surface-soft)" : "transparent",
                      color: "var(--text-primary)",
                    }}
                  >
                    <p className="font-semibold">{c.name}</p>
                    {c.description && (
                      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {c.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              2. Kies een grootte
              {isFullBleed && (
                <span className="ml-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  (Hero-slider is altijd 2×1)
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SIZE_OPTIONS.map((opt) => {
                const active = effectiveSize === opt.value;
                const disabled = isFullBleed && opt.value !== "2x1";
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSize(opt.value)}
                    className="rounded-lg border px-3 py-2 text-center text-xs disabled:opacity-40"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--surface-border)",
                      backgroundColor: active ? "var(--surface-soft)" : "transparent",
                      color: "var(--text-primary)",
                    }}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {opt.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending || !selectedKey}
            className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            Toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}
