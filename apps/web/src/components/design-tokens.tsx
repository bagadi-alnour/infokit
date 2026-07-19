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
  `:root,:root[data-theme="light"]{color-scheme:light;${themeVars(light)}`,
  `--radius-control:${String(radii.control)}px;`,
  `--radius-card:${String(radii.card)}px;`,
  `--radius-panel:${String(radii.panel)}px;}`,
  `:root[data-theme="dark"]{color-scheme:dark;${themeVars(dark)}}`,
  `@media (prefers-color-scheme: dark){:root:not([data-theme]),:root[data-theme="system"]{color-scheme:dark;${themeVars(dark)}}}`,
].join("");

const initializationScript = `(()=>{try{const key="calais-info-theme";const stored=localStorage.getItem(key);const theme=stored==="light"||stored==="dark"?stored:"system";document.documentElement.dataset.theme=theme}catch{document.documentElement.dataset.theme="system"}})()`;

export function DesignTokenStyles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export function ThemeInitializationScript() {
  return <script dangerouslySetInnerHTML={{ __html: initializationScript }} />;
}
