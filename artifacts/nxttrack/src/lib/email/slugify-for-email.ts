/**
 * Normalise a tenant slug for use as an email subdomain label.
 * Pure function — safe to import in client components for previews.
 */
export function slugifyForEmail(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "tenant";
}
