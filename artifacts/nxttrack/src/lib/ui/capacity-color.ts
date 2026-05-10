/**
 * Sprint 62 — capacity-color helper.
 *
 * Vertaalt (used, fixed_capacity, flex_capacity) naar een vaste set
 * status-keys + UI-labels + Tailwind-kleurklassen. Eén bron-van-waarheid
 * voor alle planning-views (programma-lijst, capaciteit-dashboard, evt.
 * sessie-detail). Geen i18n-machinerie — Nederlands hard-coded.
 */

export type CapacityStatus = "green" | "orange" | "red" | "blue" | "gray";

export const CAPACITY_LABEL: Record<CapacityStatus, string> = {
  green: "Genoeg plek",
  orange: "Bijna vol",
  red: "Vol",
  blue: "Overboekt",
  gray: "Onbeperkt",
};

/** Hex-kleuren — bewust niet via CSS-vars zodat de kleurband leesbaar
 *  blijft op elke tenant-theme. */
export const CAPACITY_HEX: Record<CapacityStatus, string> = {
  green: "#16a34a",
  orange: "#f59e0b",
  red: "#dc2626",
  blue: "#2563eb",
  gray: "#94a3b8",
};

/**
 * Bepaalt de capaciteit-status volgens de Sprint 62-spec:
 *   - grijs:  fixed === null  (onbeperkt)
 *   - blauw:  used > fixed      (binnen flex)
 *   - rood:   pct > 90          (91-100% én > flex)
 *   - oranje: pct > 70
 *   - groen:  pct ≤ 70
 *
 * Bij used > fixed + flex blijft het rood (slechter dan "binnen flex"
 * is niet per se erg, maar ver buiten de buffer wel).
 */
export function capacityStatus(
  used: number,
  fixed: number | null | undefined,
  flex: number | null | undefined = 0,
): CapacityStatus {
  if (fixed == null) return "gray";
  const flexN = Math.max(0, flex ?? 0);
  if (fixed === 0) return used > 0 ? "blue" : "gray";
  if (used > fixed) {
    return used <= fixed + flexN ? "blue" : "red";
  }
  const pct = (used / fixed) * 100;
  if (pct <= 70) return "green";
  if (pct <= 90) return "orange";
  return "red";
}

export function capacityLabel(
  used: number,
  fixed: number | null | undefined,
  flex: number | null | undefined = 0,
): string {
  return CAPACITY_LABEL[capacityStatus(used, fixed, flex)];
}

export function capacityHex(
  used: number,
  fixed: number | null | undefined,
  flex: number | null | undefined = 0,
): string {
  return CAPACITY_HEX[capacityStatus(used, fixed, flex)];
}

/** Voor screen-readers en tooltips — bv. "8 / 10 (oranje, bijna vol)" */
export function capacityDescription(
  used: number,
  fixed: number | null | undefined,
  flex: number | null | undefined = 0,
): string {
  const status = capacityStatus(used, fixed, flex);
  const label = CAPACITY_LABEL[status];
  if (fixed == null) return `${used} ingeschreven · ${label}`;
  const flexN = Math.max(0, flex ?? 0);
  const flexPart = flexN > 0 ? ` (+${flexN} flex)` : "";
  return `${used} / ${fixed}${flexPart} · ${label}`;
}
