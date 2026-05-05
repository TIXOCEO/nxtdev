import type { TenantModule } from "@/types/database";
import { getModuleDef } from "./module-registry";

export interface LayoutValidationResult {
  valid: boolean;
  errors: string[];
}

const ALLOWED_SIZES = new Set(["1x1", "1x2", "2x1", "2x2"]);

export interface LayoutItem {
  id: string;
  module_key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Sprint 22 — 2D collision/bounds-check op een 2-koloms grid.
 *   - x ∈ {0,1}, y ≥ 0, w ∈ {1,2}, h ∈ {1,2}
 *   - x + w ≤ 2 (past binnen 2 kolommen)
 *   - geen overlap tussen items
 *   - hero-sliders (forced full-bleed via allowedSizes) krijgen w=2 verplicht
 */
export function validateLayoutItems(items: LayoutItem[]): LayoutValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(items)) {
    return { valid: false, errors: ["Geen modules opgegeven."] };
  }

  // Per-item bounds + module sanity
  for (const it of items) {
    const def = getModuleDef(it.module_key);
    if (!def) {
      errors.push(`Onbekende module "${it.module_key}".`);
      continue;
    }
    if (it.x < 0 || it.x > 1) errors.push(`x buiten bereik voor ${it.module_key}.`);
    if (it.y < 0) errors.push(`y mag niet negatief zijn voor ${it.module_key}.`);
    if (it.w < 1 || it.w > 2) errors.push(`w buiten bereik voor ${it.module_key}.`);
    if (it.h < 1 || it.h > 2) errors.push(`h buiten bereik voor ${it.module_key}.`);
    if (it.x + it.w > 2) errors.push(`Module ${it.module_key} valt buiten 2 kolommen.`);

    const isFullBleed =
      def.allowedSizes.length === 1 && def.allowedSizes[0] === "2x1";
    if (isFullBleed && (it.w !== 2 || it.x !== 0)) {
      errors.push(`Module ${it.module_key} moet de volle breedte (w=2, x=0) hebben.`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // Overlap-check: scan rij voor rij.
  const occupied = new Map<string, string>(); // "x,y" → id
  for (const it of items) {
    for (let dx = 0; dx < it.w; dx++) {
      for (let dy = 0; dy < it.h; dy++) {
        const key = `${it.x + dx},${it.y + dy}`;
        const owner = occupied.get(key);
        if (owner && owner !== it.id) {
          errors.push(`Overlap op cel (${it.x + dx},${it.y + dy}).`);
          return { valid: false, errors };
        }
        occupied.set(key, it.id);
      }
    }
  }

  return { valid: true, errors: [] };
}

/** @deprecated Pre-sprint22 helper — gebruik `validateLayoutItems`. */
export function validateLayout(modules: TenantModule[]): LayoutValidationResult {
  // Backward-compat: kijk naar position_x/y/w/h als beschikbaar, anders sanity per item.
  const errors: string[] = [];
  for (const m of modules) {
    if (!ALLOWED_SIZES.has(m.size)) {
      errors.push(`Onbekend formaat "${m.size}" voor "${m.module_key}".`);
    }
    if (!getModuleDef(m.module_key)) {
      errors.push(`Onbekende module "${m.module_key}".`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Sprint 22 — Bepaal eerste vrije plek (x,y) voor een nieuwe module van w×h.
 * Scan rij-per-rij vanaf y=0; pakt linksboven-eerst.
 */
export function findFirstFreeSlot(
  existing: Array<{ position_x: number; position_y: number; w: number; h: number }>,
  w: number,
  h: number,
): { x: number; y: number } {
  const occupied = new Set<string>();
  let maxY = 0;
  for (const e of existing) {
    for (let dx = 0; dx < e.w; dx++) {
      for (let dy = 0; dy < e.h; dy++) {
        occupied.add(`${e.position_x + dx},${e.position_y + dy}`);
        if (e.position_y + dy + 1 > maxY) maxY = e.position_y + dy + 1;
      }
    }
  }
  // Probeer rijen 0..maxY+1
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x + w <= 2; x++) {
      let ok = true;
      for (let dx = 0; dx < w && ok; dx++) {
        for (let dy = 0; dy < h && ok; dy++) {
          if (occupied.has(`${x + dx},${y + dy}`)) ok = false;
        }
      }
      if (ok) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}
