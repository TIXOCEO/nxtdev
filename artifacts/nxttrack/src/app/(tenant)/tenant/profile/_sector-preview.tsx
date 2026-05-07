import {
  TERMINOLOGY_KEYS,
  TERMINOLOGY_KEY_LABELS,
} from "@/lib/terminology/labels";
import type { Terminology, TerminologyKey } from "@/lib/terminology/types";

export interface SectorPreviewProps {
  templateName: string | null;
  templateKey: string | null;
  terminology: Terminology;
  overrideKeys: TerminologyKey[];
}

export function SectorPreview({
  templateName,
  templateKey,
  terminology,
  overrideKeys,
}: SectorPreviewProps) {
  const overrideSet = new Set(overrideKeys);
  return (
    <div
      className="space-y-4 rounded-2xl border p-4 sm:p-6"
      style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Gekozen sector
        </p>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {templateName ? `${templateName}` : "Geen (generic fallback)"}
          {templateKey && (
            <span className="ml-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
              ({templateKey})
            </span>
          )}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          De sectorkeuze wordt door een platform-admin beheerd. Eigen overrides regel je hieronder.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Effectieve woordenschat
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TERMINOLOGY_KEYS.map((k) => (
            <div
              key={k}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{TERMINOLOGY_KEY_LABELS[k]}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {terminology[k]}
                </span>
                {overrideSet.has(k) && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                  >
                    override
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
