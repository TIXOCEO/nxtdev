import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  NXTTRACK_DARK_TOKENS,
  NXTTRACK_LIGHT_TOKENS,
  type ThemeMode,
  type ThemeTokens,
} from "@/lib/themes/defaults";

export interface ThemeRow {
  id: string;
  scope: "platform" | "tenant";
  tenant_id: string | null;
  name: string;
  mode: ThemeMode;
  tokens: ThemeTokens;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantActiveTheme {
  tenant_id: string;
  theme_id: string;
  enabled: boolean;
  created_at: string;
}

export interface UserThemePreference {
  user_id: string;
  tenant_id: string;
  mode_preference: "auto" | "light" | "dark";
  light_theme_id: string | null;
  dark_theme_id: string | null;
  updated_at: string;
}

// ── Platform / tenant theme catalog ───────────────────────

export async function listAllThemes(): Promise<ThemeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("themes")
    .select("*")
    .order("scope", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as ThemeRow[];
}

export async function listPlatformThemes(): Promise<ThemeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("themes")
    .select("*")
    .eq("scope", "platform")
    .order("mode", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as ThemeRow[];
}

export async function listTenantOwnedThemes(tenantId: string): Promise<ThemeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("themes")
    .select("*")
    .eq("scope", "tenant")
    .eq("tenant_id", tenantId)
    .order("mode", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as ThemeRow[];
}

export async function getThemeById(id: string): Promise<ThemeRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("themes").select("*").eq("id", id).maybeSingle();
  return (data as ThemeRow | null) ?? null;
}

// ── Tenant activation ─────────────────────────────────────

export async function listTenantActiveThemes(
  tenantId: string,
): Promise<TenantActiveTheme[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_active_themes")
    .select("*")
    .eq("tenant_id", tenantId);
  return (data ?? []) as TenantActiveTheme[];
}

/**
 * Themes that are available to USERS of a tenant: platform themes (always on)
 * + tenant's own themes that exist + any explicit activations. We treat
 * platform themes as always-active unless explicitly disabled in
 * tenant_active_themes (enabled=false).
 */
export async function getThemesAvailableToTenant(
  tenantId: string,
): Promise<ThemeRow[]> {
  const supabase = await createClient();
  // Single query: platform OR own-tenant themes; left-join activations.
  const { data } = await supabase
    .from("themes")
    .select("*, tenant_active_themes!left(theme_id,enabled,tenant_id)")
    .or(`scope.eq.platform,and(scope.eq.tenant,tenant_id.eq.${tenantId})`);
  type Row = ThemeRow & {
    tenant_active_themes?: Array<{ theme_id: string; enabled: boolean; tenant_id: string }>;
  };
  return ((data ?? []) as Row[])
    .filter((t) => {
      const act = t.tenant_active_themes?.find((a) => a.tenant_id === tenantId);
      return act?.enabled !== false; // platform default-on; explicit `false` disables
    })
    .map((t) => {
      const { tenant_active_themes: _ignored, ...rest } = t;
      void _ignored;
      return rest as ThemeRow;
    });
}

// ── User preferences ──────────────────────────────────────

export async function getUserThemePreference(
  userId: string,
  tenantId: string,
): Promise<UserThemePreference | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_theme_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as UserThemePreference | null) ?? null;
}

// ── Resolution ────────────────────────────────────────────

export interface ResolvedTheme {
  mode: ThemeMode;
  tokens: ThemeTokens;
  themeId: string | null;
  themeName: string;
}

/**
 * Picks the right theme tokens for a given (tenant, user, mode-hint).
 * Priority:
 *   1. Explicit user pref for that mode (light_theme_id / dark_theme_id).
 *   2. The default theme of that mode available to this tenant.
 *   3. The first available theme of that mode.
 *   4. Hard-coded NXTTRACK fallback.
 */
export async function resolveActiveTheme(
  tenantId: string,
  userId: string | null,
  desiredMode: ThemeMode,
): Promise<ResolvedTheme> {
  const available = await getThemesAvailableToTenant(tenantId);
  const ofMode = available.filter((t) => t.mode === desiredMode);

  let chosen: ThemeRow | null = null;
  if (userId) {
    const pref = await getUserThemePreference(userId, tenantId);
    const wantedId =
      desiredMode === "dark" ? pref?.dark_theme_id : pref?.light_theme_id;
    if (wantedId) {
      chosen = ofMode.find((t) => t.id === wantedId) ?? null;
    }
  }
  if (!chosen) chosen = ofMode.find((t) => t.is_default) ?? null;
  if (!chosen) chosen = ofMode[0] ?? null;

  if (chosen) {
    return {
      mode: desiredMode,
      tokens: chosen.tokens,
      themeId: chosen.id,
      themeName: chosen.name,
    };
  }
  return {
    mode: desiredMode,
    tokens: desiredMode === "dark" ? NXTTRACK_DARK_TOKENS : NXTTRACK_LIGHT_TOKENS,
    themeId: null,
    themeName: desiredMode === "dark" ? "NXTTRACK Dark" : "NXTTRACK Light",
  };
}
