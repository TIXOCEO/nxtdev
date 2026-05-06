"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/get-user";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess, isPlatformAdmin } from "@/lib/permissions";

export interface AdminHandoffResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Cross-domain admin SSO handoff.
 *
 * De publieke tenant-site kan op een subdomein (`<slug>.nxttrack.nl`) of op
 * een eigen custom-domein draaien (bv. `voetbalschool-houtrust.nl`). De
 * admin-shell woont altijd op het apex-domein (`nxttrack.nl/tenant`).
 * Browsercookies kunnen niet over verschillende registrable domains
 * gedeeld worden, dus we gebruiken Supabase's magic-link mechanisme als
 * eenmalige session-handoff:
 *
 * 1. Verifieer dat de huidige (publieke) sessie admin-rechten heeft.
 * 2. Genereer server-side een magic-link voor de user (geen e-mail
 *    verstuurd — `generateLink` retourneert de URL direct).
 * 3. `redirect_to` wijst naar `${apex}/auth/callback?next=/tenant/switch?...`
 *    zodat de browser na verify op het apex-domein landt en daar de
 *    sessie-cookies krijgt + doorstuurt naar de tenant-shell.
 *
 * SETUP-VEREISTE (eenmalig in Supabase dashboard):
 *   Auth → URL Configuration → Redirect URLs → voeg toe:
 *     https://nxttrack.nl/auth/callback
 */
export async function requestAdminHandoff(
  tenantId: string,
  nextPath?: string,
): Promise<AdminHandoffResult> {
  const user = await getUser();
  if (!user || !user.email) {
    return { ok: false, error: "Niet ingelogd." };
  }

  const safeTenantId = (tenantId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(safeTenantId)) {
    return { ok: false, error: "Ongeldige tenant-id." };
  }

  // Permissie-check: platform admin OF admin-rol op deze tenant.
  try {
    const [memberships, adminRoleTenantIds] = await Promise.all([
      getMemberships(user.id),
      getAdminRoleTenantIds(user.id),
    ]);
    const allowed =
      isPlatformAdmin(memberships) ||
      hasTenantAccess(memberships, safeTenantId, adminRoleTenantIds);
    if (!allowed) {
      return { ok: false, error: "Geen adminrechten voor deze tenant." };
    }
  } catch {
    return { ok: false, error: "Permissie-check mislukt." };
  }

  // Bouw redirect_to op het apex-domein. Het pad onder /auth/callback
  // krijgt zelf het uiteindelijke `next` mee zodat we na setSession
  // doorsturen naar de admin-shell + active-tenant cookie zetten.
  const apex = (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!apex) {
    return { ok: false, error: "APP_BASE_URL / NEXT_PUBLIC_APP_URL is niet geconfigureerd." };
  }

  const innerNext =
    nextPath && nextPath.startsWith("/") ? nextPath : "/tenant";
  // Na callback eerst via /tenant/switch zodat de active-tenant cookie
  // gezet wordt, daarna redirect naar de eigenlijke shell.
  const switchPath = `/tenant/switch?tenant=${encodeURIComponent(safeTenantId)}&next=${encodeURIComponent(innerNext)}`;
  const redirectTo = `${apex}/auth/callback?next=${encodeURIComponent(switchPath)}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      return {
        ok: false,
        error: error?.message ?? "Kon geen handoff-link genereren.",
      };
    }
    return { ok: true, url: data.properties.action_link };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Onbekende fout bij handoff.",
    };
  }
}
