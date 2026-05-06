/**
 * Sprint 29 — Centrale hoogte-mapping per module-formaat.
 * Eén bron van waarheid voor zowel publieke render als admin-grid,
 * zodat modules nooit meer per slide / per dataset van hoogte wisselen.
 */
export const ROW_HEIGHT_DESKTOP = 280;
export const ROW_HEIGHT_MOBILE = 260;
export const GRID_GAP_PX = 16;

/** Pixelhoogte voor een module van h rijen op desktop. */
export function rowsToHeightDesktop(h: number): number {
  const rows = Math.max(1, Math.min(2, h));
  return rows * ROW_HEIGHT_DESKTOP + (rows - 1) * GRID_GAP_PX;
}

/** Pixelhoogte voor een module van h rijen op mobiel. */
export function rowsToHeightMobile(h: number): number {
  const rows = Math.max(1, Math.min(2, h));
  return rows * ROW_HEIGHT_MOBILE + (rows - 1) * GRID_GAP_PX;
}
