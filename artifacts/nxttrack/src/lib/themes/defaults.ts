/**
 * Built-in fallback theme tokens used when the database has no themes yet
 * (e.g. before sprint15.sql is applied) and the seeded NXTTRACK Light/Dark
 * defaults. Kept in sync with the seed in sprint15.sql.
 */
export type ThemeMode = "light" | "dark";

export interface ThemeTokens {
  [cssVariable: string]: string;
}

export const NXTTRACK_LIGHT_TOKENS: ThemeTokens = {
  "--accent": "#b6d83b",
  "--bg-viewport-start": "#f4f6f8",
  "--bg-viewport-end": "#e9ecf1",
  "--bg-app": "#ffffff",
  "--bg-nav": "#f8f9fb",
  "--surface-main": "#ffffff",
  "--surface-soft": "#f4f6fa",
  "--surface-border": "#e3e6ee",
  "--text-primary": "#0f172a",
  "--text-secondary": "#5b6476",
  "--shadow-color": "rgba(15, 23, 42, 0.08)",
  // Sprint 78 — UserShell v2 nav-states (brand-constant, niet editable).
  "--brand-navy": "#1e3a5f",
  "--nav-active-bg": "#e5edf7",
  "--nav-active-bar": "#1e3a5f",
  "--nav-active-icon": "#1e3a5f",
  "--nav-hover-bg": "#eef2f8",
  "--accent-tint": "#eef5d8",
  // Sprint 78b — Sidebar/page-bg defaults; overschreven op shell-wrapper
  // met color-mix() zodra --tenant-accent bekend is.
  "--sidebar-bg": "#f4f8eb",
  "--page-bg": "#fbfcf9",
};

export const NXTTRACK_DARK_TOKENS: ThemeTokens = {
  "--accent": "#b6d83b",
  "--bg-viewport-start": "#0b1220",
  "--bg-viewport-end": "#05080f",
  "--bg-app": "#05080f",
  "--bg-nav": "#070b14",
  "--surface-main": "#0b1220",
  "--surface-soft": "#10192e",
  "--surface-border": "#1e2a44",
  "--text-primary": "#e6eaf2",
  "--text-secondary": "#9aa4bf",
  "--shadow-color": "rgba(0, 0, 0, 0.85)",
  // Sprint 78 — UserShell v2 nav-states. Lichter-navy zodat het zichtbaar
  // blijft op donkere achtergrond.
  "--brand-navy": "#6e8fb8",
  "--nav-active-bg": "#172338",
  "--nav-active-bar": "#6e8fb8",
  "--nav-active-icon": "#6e8fb8",
  "--nav-hover-bg": "#121c2e",
  "--accent-tint": "#2a3614",
  // Sprint 78b — Dark-mode sidebar/page-bg (zachter dan bg-nav).
  "--sidebar-bg": "#0a101c",
  "--page-bg": "#08101c",
};

/** The exact list of CSS variable names the editor UI exposes for editing. */
export const THEME_TOKEN_KEYS: readonly string[] = [
  "--accent",
  "--bg-viewport-start",
  "--bg-viewport-end",
  "--bg-app",
  "--bg-nav",
  "--surface-main",
  "--surface-soft",
  "--surface-border",
  "--text-primary",
  "--text-secondary",
  "--shadow-color",
] as const;

/** Friendly Dutch labels for the editor. */
export const THEME_TOKEN_LABELS: Record<string, string> = {
  "--accent": "Accentkleur",
  "--bg-viewport-start": "Viewport gradient (boven)",
  "--bg-viewport-end": "Viewport gradient (onder)",
  "--bg-app": "App achtergrond",
  "--bg-nav": "Navigatie achtergrond",
  "--surface-main": "Hoofd-oppervlak (cards)",
  "--surface-soft": "Zachte achtergrond (rows)",
  "--surface-border": "Randen",
  "--text-primary": "Primaire tekst",
  "--text-secondary": "Secundaire tekst",
  "--shadow-color": "Schaduwkleur",
};
