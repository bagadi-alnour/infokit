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

/**
 * A colour that survives a runtime which does not know the variable yet — an app
 * still running a bundle from before the role existed, or a provider from an
 * older `@infokit/ui`. Without the fallback such a variable resolves to nothing
 * and the text is painted in no colour at all, which on a dark canvas means
 * invisible. Legibility is never allowed to depend on a fresh bundle
 * (docs/DESIGN-SYSTEM.md rule 7: colour is a layer that may drop, text is not).
 */
const colorOr = (name, fallback) =>
  `var(--infokit-${name}, var(--infokit-${fallback}))`;

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
        // Content families (docs/DESIGN-SYSTEM.md §5): one hue per kind of card,
        // so a reader recognises an agenda entry, an article and a guide apart
        // before reading them. Structural only — never a state.
        // They fall back to plain ink on plain surface, so the worst a stale
        // bundle can do is lose the hue — never the words.
        event: colorOr("event-accent", "ink"),
        "event-wash": colorOr("event-wash", "surface-subtle"),
        article: colorOr("article-accent", "ink"),
        "article-wash": colorOr("article-wash", "surface-subtle"),
        guide: colorOr("guide-accent", "ink"),
        "guide-wash": colorOr("guide-wash", "surface-subtle"),
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
