/**
 * Centrale slug-helpers.
 *
 * `slugify()` zet elke string om naar een geldige slug:
 *   - kleine letters
 *   - spaties / underscores → "-"
 *   - diacritics worden vereenvoudigd ("café" → "cafe")
 *   - alles wat geen letter, cijfer of "-" is wordt verwijderd
 *   - meerdere streepjes achter elkaar worden samengevouwen
 *   - leidende / sluitende streepjes worden gestript
 *
 * Wordt gebruikt door zod `.transform()` op slug-velden, en door de
 * server-actions om automatisch een uniek alternatief te kiezen.
 */
export function slugify(input: string): string {
  if (!input) return "";
  return input
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Maak van `base` een unieke slug binnen een verzameling reeds gebruikte
 * slugs. Voegt `-2`, `-3`, ... toe tot er een vrije variant is.
 *
 *   findUniqueSlug("ajax", new Set(["ajax", "ajax-2"]))  // → "ajax-3"
 */
export function findUniqueSlug(base: string, taken: Set<string>): string {
  const safe = slugify(base) || "club";
  if (!taken.has(safe)) return safe;
  let i = 2;
  while (taken.has(`${safe}-${i}`)) i++;
  return `${safe}-${i}`;
}
