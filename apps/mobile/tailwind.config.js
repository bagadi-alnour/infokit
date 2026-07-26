/**
 * Mobile side of the design system. Every semantic utility comes from the
 * shared preset in @infokit/ui, so a class name means the same thing here as it
 * does on the web (docs/DESIGN-SYSTEM.md, docs/UI-ARCHITECTURE.md).
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [
    require("nativewind/preset"),
    require("@infokit/ui/tailwind-preset"),
  ],
};
