"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { getMemberships } from "@/lib/auth/get-memberships";
import { isPlatformAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called by the client login form right after `signInWithPassword` succeeds.
 * Re-reads the validated user on the server, ensures a `profiles` row exists,
 * en bepaalt waar de gebruiker naar door moet op basis van zijn rol:
 *
 * - platform_admin → /platform
 * - tenant_admin / parent / member met 1 tenant → /t/<slug>
 * - meerdere tenants of geen rol → fallback naar `requestedNext` of "/"
 */
export async function ensureProfileForCurrentUser(
  requestedNext?: string,
): Promise<{ ok: boolean; error?: string; destination?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Not authenticated." };
  }
  try {
    await ensureProfile(data.user);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Profile sync failed." };
  }

  // Bepaal post-login destination. Eerbiedig requestedNext alleen als
  // het een interne, veilige redirect is en niet "/".
  const safeNext =
    requestedNext && requestedNext.startsWith("/") && requestedNext !== "/"
      ? requestedNext
      : null;

  try {
    const memberships = await getMemberships(data.user.id);

    if (isPlatformAdmin(memberships)) {
      return { ok: true, destination: safeNext ?? "/platform" };
    }

    // Tenant-rol: stuur door naar het juiste tenant-pad. Pak eerste
    // tenant met een actieve membership.
    const tenantMembership = memberships.find(
      (m) => m.tenant_id && m.role !== "platform_admin",
    );
    if (tenantMembership?.tenant_id) {
      const admin = createAdminClient();
      const { data: tenant } = await admin
        .from("tenants")
        .select("slug")
        .eq("id", tenantMembership.tenant_id)
        .maybeSingle();
      if (tenant?.slug) {
        return { ok: true, destination: safeNext ?? `/t/${tenant.slug}` };
      }
    }
  } catch {
    // Membership lookup faalt → val terug op default redirect.
  }

  return { ok: true, destination: safeNext ?? "/" };
}

/**
 * Sign the current user out and redirect to the given path (defaults to "/").
 * Safe to call from any client component or form.
 */
export async function signOutAction(redirectTo?: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  // Sta zowel interne paden ("/t/foo") als absolute https-URLs
  // (custom-domein of subdomein van een tenant) toe.
  const safe =
    redirectTo &&
    (redirectTo.startsWith("/") ||
      /^https:\/\/[a-z0-9.-]+(\/.*)?$/i.test(redirectTo))
      ? redirectTo
      : "/";
  redirect(safe);
}

/**
 * Server-side handoff voor de /auth/callback pagina (zowel implicit-flow
 * met fragment-tokens als PKCE met `?code=`).
 *
 * Volledig server-side om browser-lock-conflicten te vermijden: de
 * callback-pagina heeft GEEN browser-Supabase-client meer nodig — wij
 * schrijven de sessie-cookies hier server-side weg via @supabase/ssr,
 * en middleware/server-componenten herkennen de sessie meteen daarna.
 */
export async function applyAuthTokensAction(input: {
  accessToken?: string | null;
  refreshToken?: string | null;
  code?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (input.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(input.code);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  if (input.accessToken && input.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: false, error: "Geen sessie-tokens of code ontvangen." };
}
