import {
  dark,
  elevation,
  light,
  radii,
  type SemanticTheme,
} from "@infokit/tokens";

/**
 * Injects the design-system tokens (docs/DESIGN-SYSTEM.md, encoded once in
 * @infokit/tokens) as CSS variables; globals.css maps them to Tailwind
 * utilities with `@theme inline`. Components never hardcode colours.
 */
function themeVars(theme: SemanticTheme): string {
  return (Object.entries(theme) as [string, string][])
    .map(
      ([key, value]) =>
        `--infokit-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value};`,
    )
    .join("");
}

/**
 * Elevation is a ring plus a soft shadow (docs/DESIGN-SYSTEM.md §4). The ring
 * comes from the border role, so dropping shadows on low-end devices still
 * leaves every card outlined.
 */
function shadowVars(theme: SemanticTheme, shadowInk: string): string {
  const ring = `0 0 0 1px ${theme.border}`;
  const step = (level: keyof typeof elevation) => {
    const { blur, y, alpha } = elevation[level];
    return `${ring},0 ${String(y)}px ${String(blur)}px rgb(${shadowInk} / ${String(alpha)})`;
  };
  return [
    `--infokit-shadow-sm:${step("sm")};`,
    `--infokit-shadow-md:${step("md")};`,
    `--infokit-shadow-lg:${step("lg")};`,
  ].join("");
}

const shapeVars = [
  `--infokit-radius-chip:${String(radii.chip)}px;`,
  `--infokit-radius-control:${String(radii.control)}px;`,
  `--infokit-radius-card:${String(radii.card)}px;`,
  `--infokit-radius-panel:${String(radii.panel)}px;`,
].join("");

const lightVars = `color-scheme:light;${themeVars(light)}${shadowVars(light, "16 35 31")}${shapeVars}`;
const darkVars = `color-scheme:dark;${themeVars(dark)}${shadowVars(dark, "0 0 0")}${shapeVars}`;

const css = [
  `:root,:root[data-theme="light"]{${lightVars}}`,
  `:root[data-theme="dark"]{${darkVars}}`,
  `@media (prefers-color-scheme: dark){:root:not([data-theme]),:root[data-theme="system"]{${darkVars}}}`,
  // Paper takes ink, whatever the screen was wearing: a reader who saves an
  // activity page while reading in the dark would otherwise get pale text on a
  // white sheet, because a printer drops backgrounds and keeps colours. Last,
  // and at the specificity of the rules above, so it wins both of them.
  `@media print{:root:not([data-theme]),:root[data-theme]{${lightVars}}}`,
].join("");

export function DesignTokenStyles() {
  return (
    <style
      id="infokit-design-tokens"
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
