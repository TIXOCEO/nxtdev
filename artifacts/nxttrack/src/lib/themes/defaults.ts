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
