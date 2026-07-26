/**
 * Mobile side of the design system. Every semantic utility comes from the
 * shared preset in @infokit/ui, so a class name means the same thing here as it
 * does on the web (docs/DESIGN-SYSTEM.md, docs/UI-ARCHITECTURE.md).
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  // The scheme is applied as CSS variables by InfoKitThemeProvider, never with
  // `dark:` utilities — but NativeWind's web runtime refuses to accept a scheme
  // at all while this flag says `media`, which crashes `expo start --web`.
  darkMode: "class",
  presets: [
    require("nativewind/preset"),
    require("@infokit/ui/tailwind-preset"),
  ],
};
