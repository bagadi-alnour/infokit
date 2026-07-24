import { dark, light, radii, type SemanticTheme } from "@calais/tokens";

/**
 * Injects docs/DESIGN.md tokens (via @calais/tokens — the single encoding)
 * as CSS variables; globals.css maps them to Tailwind utilities with
 * `@theme inline`. Components never hardcode colors (AGENTS.md rule 2).
 */
function themeVars(theme: SemanticTheme): string {
  return (Object.entries(theme) as [string, string][])
    .map(
      ([key, value]) =>
        `--calais-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value};`,
    )
    .join("");
}

const css = [
  `:root,:root[data-theme="light"]{color-scheme:light;${themeVars(light)}`,
  `--calais-radius-control:${String(radii.control)}px;`,
  `--calais-radius-card:${String(radii.card)}px;`,
  `--calais-radius-panel:${String(radii.panel)}px;}`,
  `:root[data-theme="dark"]{color-scheme:dark;${themeVars(dark)}}`,
  `@media (prefers-color-scheme: dark){:root:not([data-theme]),:root[data-theme="system"]{color-scheme:dark;${themeVars(dark)}}}`,
].join("");

export function DesignTokenStyles() {
  return (
    <style
      id="calais-design-tokens"
      // Tamagui moves its generated client stylesheet into the document head.
      // The token CSS is static; suppress only the resulting style-node ordering mismatch.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
