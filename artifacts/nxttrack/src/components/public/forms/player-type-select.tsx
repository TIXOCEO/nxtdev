"use client";

import type { PlayerType } from "@/types/database";

export interface PlayerTypeSelectProps {
  value: PlayerType | "";
  onChange: (v: PlayerType) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
}

const OPTIONS: Array<{ value: PlayerType; label: string }> = [
  { value: "player", label: "Speler" },
  { value: "goalkeeper", label: "Keeper" },
];

export function PlayerTypeSelect({
  value,
  onChange,
  disabled,
  id,
}: PlayerTypeSelectProps) {
  return (
    <div role="radiogroup" aria-label="Type speler" className="grid grid-cols-2 gap-2">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            id={id ? `${id}-${opt.value}` : undefined}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className="h-10 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              borderColor: active ? "var(--tenant-accent)" : "var(--surface-border)",
              backgroundColor: active
                ? "color-mix(in srgb, var(--tenant-accent) 22%, transparent)"
                : "var(--surface-main)",
              color: "var(--text-primary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
