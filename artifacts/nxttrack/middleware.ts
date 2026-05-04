import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { slugFromHostname, slugFromPathname } from "./src/lib/tenant";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";

  /**
   * Build a mutable response.
   * The Supabase SSR client may call setAll() to refresh session cookies —
   * when it does, it rebuilds `supabaseResponse` so cookies are written
   * back to the browser correctly.
   */
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  /**
   * Refresh the session token if it has expired.
   * Do NOT use getSession() here — getUser() validates against Supabase servers.
   * IMPORTANT: do not add logic between createServerClient and getUser().
   */
  await supabase.auth.getUser();

  // ── Tenant slug resolution ───────────────────────────────────────────────
  let tenantSlug = slugFromHostname(hostname);
  if (!tenantSlug) {
    tenantSlug = slugFromPathname(pathname);
  }
  if (tenantSlug) {
    supabaseResponse.headers.set("x-tenant-slug", tenantSlug);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
