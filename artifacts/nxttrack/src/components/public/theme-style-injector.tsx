import type { ThemeTokens } from "@/lib/themes/defaults";

interface Props {
  light: ThemeTokens;
  dark: ThemeTokens;
}

function tokensToCss(tokens: ThemeTokens): string {
  return Object.entries(tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
}

/**
 * Server-rendered <style> block holding the resolved light + dark theme
 * variables. The wrapper element picks one of three class names:
 *   .theme-light  → always light
 *   .theme-dark   → always dark
 *   .theme-auto   → light by default, dark when the user's OS prefers dark
 */
export function ThemeStyleInjector({ light, dark }: Props) {
  const css = `
    .theme-light{${tokensToCss(light)}}
    .theme-dark{${tokensToCss(dark)}}
    .theme-auto{${tokensToCss(light)}}
    @media (prefers-color-scheme: dark){.theme-auto{${tokensToCss(dark)}}}
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
