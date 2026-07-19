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
        `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value};`,
    )
    .join("");
}

const css = [
  `:root{color-scheme:light dark;${themeVars(light)}`,
  `--radius-control:${String(radii.control)}px;`,
  `--radius-card:${String(radii.card)}px;`,
  `--radius-panel:${String(radii.panel)}px;}`,
  `@media (prefers-color-scheme: dark){:root{${themeVars(dark)}}}`,
].join("");

export function DesignTokenStyles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
