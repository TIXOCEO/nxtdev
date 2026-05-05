import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * NXTTRACK middleware — combineert twee verantwoordelijkheden in één file
 * (Next.js gebruikt slechts één middleware; bij conflict tussen root en
 *  src/ wint de root, wat eerder de custom-domain rewrite saboteerde):
 *
 * 1. Multi-tenant routing
 *    - `nxttrack.nl` / `www.nxttrack.nl`           → marketing (geen rewrite)
 *    - `<slug>.nxttrack.nl/...`                    → rewrite naar `/t/<slug>/...`
 *    - custom domeinen (bv. `voetbalschool-houtrust.nl`) → host-lookup via
 *      `/api/tls-check` (DB-driven, in-memory gecached) → rewrite
 *
 * 2. Supabase sessie-refresh — vernieuwt verlopen tokens vóór elke request,
 *    zodat Server Components een geldige sessie zien. Dit MOET gebeuren op
 *    de uiteindelijke (eventueel rewritten) response, anders worden
 *    refresh-cookies niet teruggeschreven naar de browser.
 *
 * Lokaal (replit.dev / localhost) is er geen subdomein-magie nodig: alle
 * klantsites blijven bereikbaar via `/t/<slug>` zoals voorheen.
 */
const APEX_DOMAIN = (process.env.APEX_DOMAIN || "nxttrack.nl").toLowerCase();

/**
 * Optionele snel-cache via env var voor noodgevallen / edge cases.
 * Format: `host=slug,host2=slug2`. DB-lookup is leidend, dit is een
 * fast-path die geen netwerkroundtrip nodig heeft.
 */
const CUSTOM_DOMAIN_ENV: Map<string, string> = (() => {
  const raw = process.env.CUSTOM_DOMAIN_MAP ?? "";
  const m = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const [domain, slug] = pair.split("=").map((s) => s?.trim().toLowerCase());
    if (domain && slug) m.set(domain, slug);
    if (domain && slug && !domain.startsWith("www.")) {
      m.set(`www.${domain}`, slug);
    }
  }
  return m;
})();

const RESERVED_SUBDOMAINS = new Set<string>([
  "www", "app", "api", "admin", "platform", "staging", "dev", "test",
  "mail", "m", "assets", "cdn", "static", "ftp", "smtp", "imap",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// ── DB-backed host→slug cache (TTL 60s, met negative-cache 30s) ──────────
interface DbCacheEntry {
  slug: string | null;
  expires: number;
}
const dbCache: Map<string, DbCacheEntry> = new Map();
const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 30_000;

async function lookupHostInDb(host: string, origin: string): Promise<string | null> {
  const hit = dbCache.get(host);
  if (hit && hit.expires > Date.now()) return hit.slug;
  try {
    const res = await fetch(
      `${origin}/api/tls-check?domain=${encodeURIComponent(host)}`,
      { cache: "no-store" },
    );
    if (res.status === 200) {
      const body = (await res.json()) as { slug?: string; kind?: string };
      // `kind: "apex"` betekent: dit is een apex/subdomein van onze eigen
      // host — geen rewrite nodig. We cachen dat als null.
      const slug = body.kind === "tenant" ? body.slug ?? null : null;
      dbCache.set(host, { slug, expires: Date.now() + POSITIVE_TTL_MS });
      return slug;
    }
    dbCache.set(host, { slug: null, expires: Date.now() + NEGATIVE_TTL_MS });
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve de tenant-slug die hoort bij `host` (custom domein, subdomein of
 * niets). Retourneert `null` voor apex/www/onbekende hosts.
 */
async function resolveSlug(req: NextRequest, host: string): Promise<string | null> {
  if (!host) return null;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".replit.dev") ||
    host.endsWith(".replit.app") ||
    host.endsWith(".repl.co")
  ) {
    return null;
  }
  if (host === APEX_DOMAIN || host === `www.${APEX_DOMAIN}`) return null;

  // 1. Env-var snel-cache.
  const envSlug = CUSTOM_DOMAIN_ENV.get(host);
  if (envSlug) return envSlug;

  // 2. Subdomein onder onze eigen apex.
  if (host.endsWith(`.${APEX_DOMAIN}`)) {
    const sub = host.slice(0, -1 * (`.${APEX_DOMAIN}`.length));
    if (sub.includes(".")) return null;
    if (RESERVED_SUBDOMAINS.has(sub)) return null;
    if (!SLUG_RE.test(sub)) return null;
    return sub;
  }

  // 3. Onbekende host → DB-lookup met cache.
  return lookupHostInDb(host, req.nextUrl.origin);
}

/**
 * Maak Supabase SSR client en refresh sessie-cookies op de gegeven
 * response. Deze functie muteert `response` (cookies worden gezet) en
 * retourneert hetzelfde object voor chaining.
 */
async function refreshSupabaseSession(
  req: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  let current = response;
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          current.cookies.set(name, value, options),
        );
      },
    },
  });

  // Validate against Supabase servers; refreshes the access token if expired.
  // Belangrijk: NIET getSession() gebruiken hier.
  await supabase.auth.getUser();
  return current;
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const url = req.nextUrl;

  const slug = await resolveSlug(req, host);

  // Bouw de basis-response: rewrite indien nodig, anders next().
  let response: NextResponse;
  if (slug && url.pathname !== `/t/${slug}` && !url.pathname.startsWith(`/t/${slug}/`)) {
    const newPath = `/t/${slug}${url.pathname === "/" ? "" : url.pathname}`;
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
      url.protocol.replace(":", "") ||
      "https";
    const rewriteTarget = new URL(`${newPath}${url.search}`, `${proto}://${host}`);
    response = NextResponse.rewrite(rewriteTarget, { request: req });
  } else {
    response = NextResponse.next({ request: req });
  }

  // Refresh Supabase sessie op dezelfde response zodat cookies meegaan.
  return refreshSupabaseSession(req, response);
}

export const config = {
  // Sla statische bestanden, _next/internals en api-routes over (api-routes
  // moeten direct werken zonder rewrite, en hebben geen sessie-refresh
  // nodig — Server Actions gebruiken hun eigen Supabase-client).
  matcher: [
    "/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
