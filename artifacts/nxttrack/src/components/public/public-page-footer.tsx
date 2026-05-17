import { listActiveSocialLinks } from "@/lib/db/social-links";
import { SocialIcon } from "./social-icon";
import { findSocialPlatform } from "@/lib/social/catalog";

export interface PublicPageFooterProps {
  tenantId: string;
  tenantName: string;
}

/**
 * Sprint 78b — Page-level footer onderaan elke publieke tenant-pagina.
 * Toont copyright links en de actieve social-links rechts (mockup-stijl).
 */
export async function PublicPageFooter({
  tenantId,
  tenantName,
}: PublicPageFooterProps) {
  const links = await listActiveSocialLinks(tenantId);
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-8 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row"
      style={{
        borderColor: "var(--surface-border)",
        color: "var(--text-secondary)",
      }}
    >
      <p className="text-sm font-medium">
        © {year} {tenantName}
      </p>
      {links.length > 0 && (
        <div className="flex items-center gap-4">
          {links.map((l) => {
            const def = findSocialPlatform(l.platform);
            if (!def) return null;
            return (
              <a
                key={l.id}
                href={l.url}
                target={
                  l.url.startsWith("mailto:") || l.url.startsWith("tel:")
                    ? undefined
                    : "_blank"
                }
                rel="noopener noreferrer"
                aria-label={def.label}
                title={def.label}
                className="transition-opacity hover:opacity-70"
              >
                <SocialIcon platform={l.platform} size={18} />
              </a>
            );
          })}
        </div>
      )}
    </footer>
  );
}
