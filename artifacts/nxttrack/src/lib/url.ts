/**
 * Tenant-aware URL builder.
 *
 * Wordt gebruikt om links in mails (en andere out-of-band kanalen) altijd
 * naar de juiste host te bouwen:
 *
 *   1. Heeft de tenant een eigen `domain` ingesteld → `https://<domain>`
 *   2. Anders → `https://<slug>.<APEX_DOMAIN>`
 *   3. Lokaal/dev (geen apex bekend) → fallback naar generieke base + `/t/<slug>`
 *
 * Voor links zonder tenant-context (bv. publieke marketing) blijft
 * `appBaseUrl()` beschikbaar.
 */

const APEX_DOMAIN = process.env.APEX_DOMAIN || "nxttrack.nl";

function appBaseUrlInternal(): string {
  const explicit = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const first = replitDomains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  return "http://localhost";
}

/** Generieke app-basis (apex). Geschikt voor marketing/login. */
export function appBaseUrl(): string {
  return appBaseUrlInternal();
}

export interface TenantHostInfo {
  slug: string;
  /** Custom domein zoals `voetbalschool-houtrust.nl` (of null/undefined). */
  domain?: string | null;
}

/**
 * Bouw de basis-URL voor een specifieke tenant. Geeft GEEN trailing slash.
 *
 * In productie:
 *   - tenant.domain gezet           → `https://voetbalschool-houtrust.nl`
 *   - geen domain                   → `https://voetbalschool-houtrust.nxttrack.nl`
 *
 * Lokaal/dev: gebruik `appBaseUrl()` plus `/t/<slug>` zodat links blijven
 * werken zonder DNS-magic.
 */
export function tenantBaseUrl(tenant: TenantHostInfo): string {
  const domain = (tenant.domain ?? "").trim().toLowerCase();
  if (domain) return `https://${domain}`;

  const explicit = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) {
    try {
      const u = new URL(explicit);
      // Productie: subdomein van apex.
      if (u.hostname === APEX_DOMAIN || u.hostname.endsWith(`.${APEX_DOMAIN}`)) {
        return `https://${tenant.slug}.${APEX_DOMAIN}`;
      }
      // Andere expliciete base (bv. staging) → fallback met /t/<slug>.
      return `${appBaseUrlInternal()}/t/${tenant.slug}`;
    } catch {
      /* doorvallen */
    }
  }

  // Geen expliciete app-URL → dev/Replit/localhost: pad-gebaseerd.
  return `${appBaseUrlInternal()}/t/${tenant.slug}`;
}

/**
 * Bouw een volledige tenant-URL voor een gegeven pad.
 * `path` mag met of zonder leading `/` worden opgegeven.
 */
export function tenantUrl(tenant: TenantHostInfo, path = ""): string {
  const base = tenantBaseUrl(tenant);
  if (!path) return base;
  const p = path.startsWith("/") ? path : `/${path}`;
  // Als base al pad-gebaseerd is (`.../t/<slug>`) blijft dit correct werken.
  return `${base}${p}`;
}
