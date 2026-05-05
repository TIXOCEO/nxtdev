import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Multi-tenant routing via subdomein.
 *
 * - `nxttrack.nl`              → blijft `/`  (marketing-site)
 * - `www.nxttrack.nl`          → blijft `/`  (marketing-site)
 * - `nxttrack.nl/platform/...` → blijft       (platform-admin)
 * - `<slug>.nxttrack.nl/...`   → wordt intern doorgestuurd naar `/t/<slug>/...`
 *
 * Lokaal (replit.dev / localhost) is er geen subdomein-magie nodig: alle
 * klantsites blijven bereikbaar via `/t/<slug>` zoals voorheen.
 *
 * Reserved subdomeinen worden behandeld als root (geen tenant-rewrite).
 */
const APEX_DOMAIN = "nxttrack.nl";

const RESERVED_SUBDOMAINS = new Set<string>([
  "www",
  "app",
  "api",
  "admin",
  "platform",
  "staging",
  "dev",
  "test",
  "mail",
  "m",
  "assets",
  "cdn",
  "static",
  "ftp",
  "smtp",
  "imap",
]);

/** Slug-regels: 1+ kleine letter/cijfer/streepje, niet beginnen/eindigen met streepje. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const url = req.nextUrl;

  // Geen host of duidelijk dev/preview → niets rewriten.
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

  // Subdomein onder onze apex?
  if (!host.endsWith(`.${APEX_DOMAIN}`)) {
    return NextResponse.next();
  }

  const sub = host.slice(0, -1 * (`.${APEX_DOMAIN}`.length));
  // Multi-level (bv. "x.y.nxttrack.nl") laten we ongemoeid.
  if (sub.includes(".")) return NextResponse.next();

  if (RESERVED_SUBDOMAINS.has(sub)) return NextResponse.next();
  if (!SLUG_RE.test(sub)) return NextResponse.next();

  // Vermijd dubbele rewrites als pad al onder /t/<slug> zit.
  if (url.pathname === `/t/${sub}` || url.pathname.startsWith(`/t/${sub}/`)) {
    return NextResponse.next();
  }

  // Interne rewrite: het pad blijft zichtbaar in de URL-balk, maar Next.js
  // serveert de tenant-routes onder /t/<slug>/...
  //
  // NB: in productie achter een reverse proxy (nginx) bevat `req.nextUrl` het
  // interne bind-adres (`localhost:<PORT>`) gecombineerd met `X-Forwarded-Proto:
  // https`. Als we die URL klonen zou NextResponse.rewrite het als externe
  // proxy zien en een HTTPS-fetch doen naar een HTTP-poort (EPROTO). Daarom
  // bouwen we de rewrite-URL expliciet vanaf de inkomende public host.
  const newPath = `/t/${sub}${url.pathname === "/" ? "" : url.pathname}`;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    url.protocol.replace(":", "") ||
    "https";
  const rewriteTarget = new URL(
    `${newPath}${url.search}`,
    `${proto}://${req.headers.get("host") ?? host}`,
  );
  return NextResponse.rewrite(rewriteTarget);
}

export const config = {
  // Sla statische bestanden, _next/internals, api-routes en de manifest over.
  matcher: [
    "/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
