import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

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

// Supabase admin client (service-role). Eerder belde middleware
// `/api/tls-check` via fetch over de publieke origin, maar dat ging op
// productie door Cloudflare → Caddy → Next, en die roundtrip kan
// blokkeren (CF anti-loop, TLS-handshake, rate limit). Resultaat: de
// fetch faalde stil, slug werd 30s lang als null gecached, en custom
// domeinen vielen terug op de marketing-site. We bevragen de DB nu
// rechtstreeks — zelfde service-role key, geen netwerk-omweg.
let dbClient: SupabaseClient | null = null;
function getDbClient(): SupabaseClient | null {
  if (dbClient) return dbClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  dbClient = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return dbClient;
}

async function lookupHostInDb(host: string): Promise<string | null> {
  const hit = dbCache.get(host);
  if (hit && hit.expires > Date.now()) return hit.slug;

  const client = getDbClient();
  if (!client) return null;

  // Strip eventuele "www." voor de match — we slaan het kale domein op
  // maar accepteren beide varianten.
  const candidates = host.startsWith("www.") ? [host.slice(4), host] : [host, `www.${host}`];

  try {
    const { data, error } = await client
      .from("tenants")
      .select("slug, status")
      .in("domain", candidates)
      .limit(1);

    if (error) {
      // Bij DB-fout: kort negative cachen, niet 30s vasthouden — dan herstelt
      // het systeem zich snel zodra de DB weer reageert.
      dbCache.set(host, { slug: null, expires: Date.now() + 5_000 });
      return null;
    }

    const row = (data ?? [])[0] as { slug: string; status: string } | undefined;
    const slug = row && row.status === "active" ? row.slug : null;
    dbCache.set(host, {
      slug,
      expires: Date.now() + (slug ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
    });
    return slug;
  } catch {
    dbCache.set(host, { slug: null, expires: Date.now() + 5_000 });
    return null;
  }
}

/**
 * Resolve de tenant-slug die hoort bij `host` (custom domein, subdomein of
 * niets). Retourneert `null` voor apex/www/onbekende hosts.
 */
async function resolveSlug(host: string): Promise<string | null> {
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

  // 3. Onbekende host → directe DB-lookup met cache.
  return lookupHostInDb(host);
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

  const slug = await resolveSlug(host);

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

  // Debug-header zodat we kunnen zien dat middleware echt draaide en wat
  // hij heeft gedaan. Verwijder zodra we zeker weten dat alles werkt.
  response.headers.set(
    "x-nxt-mw",
    `host=${host} slug=${slug ?? "-"} path=${url.pathname}`,
  );

  // Refresh Supabase sessie op dezelfde response zodat cookies meegaan.
  return refreshSupabaseSession(req, response);
}

export const config = {
  // Sla statische bestanden, _next/internals en api-routes over.
  // Belangrijk: pattern moet ook `/` matchen — sommige `(?!...).*` patronen
  // doen dat niet betrouwbaar in path-to-regexp. We voegen `/` los toe.
  matcher: [
    "/",
    "/((?!_next/|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
