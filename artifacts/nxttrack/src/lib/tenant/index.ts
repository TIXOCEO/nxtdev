/**
 * Tenant resolution utilities.
 *
 * Resolution order (future-ready):
 * 1. Subdomain  — e.g. acme.nxttrack.com  → slug "acme"
 * 2. Path param — e.g. /t/acme            → slug "acme"
 *
 * The resolved slug is stored in the x-tenant-slug request header
 * by middleware.ts so all Server Components can read it cheaply.
 */

/**
 * Extract a tenant slug from a hostname.
 * Returns null if the hostname is the root domain or localhost.
 */
export function slugFromHostname(hostname: string): string | null {
  // Strip port
  const host = hostname.split(":")[0];

  // Skip localhost and common root patterns
  const rootPatterns = ["localhost", "127.0.0.1", "nxttrack.com", "nxttrack.app"];
  if (rootPatterns.some((p) => host === p || host.endsWith(`.${p}`) === false && host === p)) {
    return null;
  }

  // Subdomain check: acme.nxttrack.com → "acme"
  const parts = host.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    // Ignore www
    if (sub !== "www") return sub;
  }

  return null;
}

/**
 * Extract a tenant slug from a URL pathname.
 * e.g. /t/acme/dashboard → "acme"
 */
export function slugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/t\/([^/]+)/);
  return match ? match[1] : null;
}
