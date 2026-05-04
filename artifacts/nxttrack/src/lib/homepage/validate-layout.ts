import type { TenantModule } from "@/types/database";
import { getModuleDef } from "./module-registry";

export interface LayoutValidationResult {
  valid: boolean;
  errors: string[];
}

const ALLOWED_SIZES = new Set(["1x1", "1x2", "2x1"]);

/**
 * Row-based layout validation. The grid is 2 columns wide:
 *   - "1x1" occupies one cell (paired with another 1x1, or alone in a row → valid).
 *   - "1x2" occupies a single cell tall (full-width row, takes whole row).
 *   - "2x1" spans both columns horizontally (full-width row).
 *
 * We pack greedily by `position`. Any 1x1 not paired in a row is allowed
 * (treated as a half-row); paired 1x1 + 1x1 forms a row; 1x2 / 2x1 take
 * a full row each. We reject duplicate positions and unknown sizes.
 */
export function validateLayout(modules: TenantModule[]): LayoutValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(modules)) {
    return { valid: false, errors: ["Geen modules opgegeven."] };
  }

  const positions = new Set<number>();
  for (const m of modules) {
    if (!ALLOWED_SIZES.has(m.size)) {
      errors.push(`Onbekend formaat "${m.size}" voor module "${m.module_key}".`);
    }
    if (positions.has(m.position)) {
      errors.push(`Dubbele positie ${m.position} gedetecteerd.`);
    }
    positions.add(m.position);
    if (!getModuleDef(m.module_key)) {
      errors.push(`Onbekende module "${m.module_key}".`);
    }
  }

  // Greedy row packing — purely a sanity check; "alone" 1x1 is fine.
  const sorted = [...modules].sort((a, b) => a.position - b.position);
  let col = 0; // 0 or 1 (index of next free column in current row)
  for (const m of sorted) {
    if (m.size === "1x1") {
      if (col === 0) col = 1;
      else col = 0; // row complete
    } else {
      // full-width module — must start a fresh row
      if (col !== 0) {
        // we silently flush by starting a fresh row; not an error.
        col = 0;
      }
      col = 0; // row complete
    }
  }

  return { valid: errors.length === 0, errors };
}
