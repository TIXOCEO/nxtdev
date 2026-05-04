import { listActiveSocialLinks } from "@/lib/db/social-links";
import { SocialIcon } from "./social-icon";
import { findSocialPlatform } from "@/lib/social/catalog";

export interface SocialBarProps {
  tenantId: string;
}

/**
 * Renders the active social links of a tenant as a centered row of
 * round accent-tinted icon buttons. Hidden when no active links exist.
 */
export async function SocialBar({ tenantId }: SocialBarProps) {
  const links = await listActiveSocialLinks(tenantId);
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3">
      {links.map((l) => {
        const def = findSocialPlatform(l.platform);
        if (!def) return null;
        return (
          <a
            key={l.id}
            href={l.url}
            target={l.url.startsWith("mailto:") || l.url.startsWith("tel:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            aria-label={def.label}
            title={def.label}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-primary)",
            }}
          >
            <SocialIcon platform={l.platform} size={14} />
          </a>
        );
      })}
    </div>
  );
}
