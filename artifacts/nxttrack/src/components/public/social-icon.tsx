import { findSocialPlatform } from "@/lib/social/catalog";

export interface SocialIconProps {
  platform: string;
  size?: number;
  className?: string;
}

/** Renders the inline SVG icon for a social platform. */
export function SocialIcon({ platform, size = 16, className }: SocialIconProps) {
  const def = findSocialPlatform(platform);
  if (!def) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d={def.svgPath} />
    </svg>
  );
}
