import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Multi-tenant routing via subdomein én custom domeinen.
 *
 * - `nxttrack.nl`              → blijft `/`  (marketing-site)
 * - `www.nxttrack.nl`          → blijft `/`  (marketing-site)
 * - `nxttrack.nl/platform/...` → blijft       (platform-admin)
 * - `<slug>.nxttrack.nl/...`   → wordt intern doorgestuurd naar `/t/<slug>/...`
 * - `voetbalschool-houtrust.nl` (custom domein) → host-lookup via
 *   `/api/tls-check` (DB-driven, in-memory gecached) → rewrite
 *
 * Lokaal (replit.dev / localhost) is er geen subdomein-magie nodig: alle
 * klantsites blijven bereikbaar via `/t/<slug>` zoals voorheen.
 *
 * Reserved subdomeinen worden behandeld als root (geen tenant-rewrite).
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

function rewriteToSlug(req: NextRequest, host: string, slug: string) {
  const url = req.nextUrl;
  if (url.pathname === `/t/${slug}` || url.pathname.startsWith(`/t/${slug}/`)) {
    return NextResponse.next();
  }
  const newPath = `/t/${slug}${url.pathname === "/" ? "" : url.pathname}`;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    url.protocol.replace(":", "") ||
    "https";
  const rewriteTarget = new URL(`${newPath}${url.search}`, `${proto}://${host}`);
  return NextResponse.rewrite(rewriteTarget);
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const url = req.nextUrl;

  if (!host) return NextResponse.next();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".replit.dev") ||
    host.endsWith(".replit.app") ||
    host.endsWith(".repl.co")
  ) {
    return NextResponse.next();
  }

  // Apex en www → marketing-site (root) of /platform; geen rewrite.
  if (host === APEX_DOMAIN || host === `www.${APEX_DOMAIN}`) {
    return NextResponse.next();
  }

  // 1. Env-var snel-cache (handig voor staging / debug).
  const envSlug = CUSTOM_DOMAIN_ENV.get(host);
  if (envSlug) return rewriteToSlug(req, host, envSlug);

  // 2. Subdomein onder onze eigen apex.
  if (host.endsWith(`.${APEX_DOMAIN}`)) {
    const sub = host.slice(0, -1 * (`.${APEX_DOMAIN}`.length));
    if (sub.includes(".")) return NextResponse.next();
    if (RESERVED_SUBDOMAINS.has(sub)) return NextResponse.next();
    if (!SLUG_RE.test(sub)) return NextResponse.next();
    return rewriteToSlug(req, host, sub);
  }

  // 3. Onbekende host → DB-lookup met cache. Dit is hoe nieuwe custom
  //    domeinen direct werken na een UI-wijziging zonder PM2 restart.
  const dbSlug = await lookupHostInDb(host, url.origin);
  if (dbSlug) return rewriteToSlug(req, host, dbSlug);

  // Geen match → laat door naar default Next.js routing (resulteert in
  // marketing-site of 404, afhankelijk van het pad).
  return NextResponse.next();
}

export const config = {
  // Sla statische bestanden, _next/internals, api-routes en de manifest over.
  matcher: [
    "/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
