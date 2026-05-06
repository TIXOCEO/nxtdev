/**
 * Bouw de publieke URL voor een tenant. Custom-domein heeft voorrang;
 * anders subdomein onder APEX_DOMAIN. Zonder apex-config valt terug op
 * het relatieve `/t/<slug>` pad zodat de link in dev nooit stuk gaat.
 *
 * Wordt o.a. gebruikt door de "Publieke site"-knop in de tenant-admin
 * header en door de uitlog-redirect in de user-shell.
 */
export function buildPublicTenantUrl(
  slug?: string | null,
  domain?: string | null,
): string | null {
  if (!slug) return null;
  if (domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return `https://${domain}`;
  }
  const apex = (
    process.env.NEXT_PUBLIC_APEX_DOMAIN ?? process.env.APEX_DOMAIN ?? ""
  ).trim();
  if (apex) return `https://${slug}.${apex}`;
  return `/t/${slug}`;
}
