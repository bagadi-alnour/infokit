/**
 * NativeWind preset for the InfoKit mobile surface.
 *
 * Utility names are deliberately identical to the web ones (see
 * apps/web/src/styles/globals.css `@theme inline`), so a rule read in
 * docs/DESIGN-SYSTEM.md maps to the same class on both platforms:
 * `bg-surface`, `text-copy-muted`, `border-line`, `bg-brand-soft`, …
 *
 * Colours are CSS variables, never literals: `InfoKitThemeProvider` injects
 * them at runtime from @infokit/tokens (light or dark), which is the same
 * mechanism the web app uses. Rule (AGENTS.md): no colour decisions in
 * components.
 *
 * CommonJS on purpose — Tailwind loads this file with `require` from the app's
 * `tailwind.config.js`, so it cannot import the TypeScript token module. The
 * numeric scales below mirror docs/DESIGN-SYSTEM.md §4 (`radii`, `touchTarget`,
 * `minBodyFontSize` in @infokit/tokens); the colour scale, which changes far
 * more often, stays single-sourced through the variables.
 */
const color = (name) => `var(--infokit-${name})`;

module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: color("canvas"),
        surface: color("surface"),
        subtle: color("surface-subtle"),
        ink: color("ink"),
        // Secondary copy — labels and metadata, never body text.
        "copy-muted": color("text-muted"),
        line: color("border"),
        "line-strong": color("border-strong"),
        brand: color("accent"),
        "brand-hover": color("accent-hover"),
        // The only accent allowed for copy on canvas/surface.
        "brand-deep": color("accent-deep"),
        "brand-ink": color("accent-contrast"),
        "brand-soft": color("accent-soft"),
        "brand-soft-ink": color("accent-soft-ink"),
        ok: color("success"),
        "ok-soft": color("success-soft"),
        warn: color("warning"),
        "warn-soft": color("warning-soft"),
        danger: color("danger"),
        "danger-soft": color("danger-soft"),
        neutral: color("neutral-status"),
        "neutral-soft": color("neutral-status-soft"),
      },
      fontFamily: {
        // Loaded by the app with expo-font under exactly these names
        // (`fontFamilies` in @infokit/tokens): geometric for headings, highly
        // legible for body.
        display: ["Work Sans"],
        body: ["Public Sans"],
        arabic: ["Noto Sans Arabic"],
      },
      borderRadius: {
        chip: "8px",
        control: "12px",
        card: "20px",
        panel: "20px",
      },
      fontSize: {
        // Body copy never goes below 16px — the app is read on borrowed phones.
        base: ["16px", "24px"],
        eyebrow: ["13px", "16px"],
      },
      minHeight: {
        // Public touch target (docs/DESIGN-SYSTEM.md §4).
        touch: "48px",
      },
    },
  },
};
