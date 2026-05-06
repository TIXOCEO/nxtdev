import { Suspense } from "react";
import { AuthCallbackClient } from "./_client";

export const dynamic = "force-dynamic";

/**
 * Apex-domein landingspagina voor Supabase magic-link / SSO-handoff.
 * Leest `#access_token` + `#refresh_token` uit de URL-fragment, zet de
 * sessie via de browser-client (zodat cookies op `nxttrack.nl` landen)
 * en stuurt door naar `?next=`.
 *
 * Gebruikt door `requestAdminHandoff()` om admins vanaf een tenant-
 * subdomein of custom-domein zonder opnieuw inloggen in `/tenant` te
 * krijgen.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackClient />
    </Suspense>
  );
}
