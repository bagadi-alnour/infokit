/**
 * @infokit/ui — the native (React Native Reusables + NativeWind) design-system
 * layer for apps/mobile. The web app has its own adapter of the same tokens in
 * apps/web/src/components; nothing here is imported by Next.
 *
 * Utility names match the web ones exactly, so docs/DESIGN-SYSTEM.md reads the
 * same on both platforms. Colours arrive as variables from `InfoKitThemeProvider`.
 */
export { Button, type ButtonProps } from "./components/button";
export { Callout, type CalloutTone } from "./components/callout";
export { Card, CardDescription, CardTitle, MetaRow } from "./components/card";
export { Input, type InputProps } from "./components/input";
export { Chip, StatusPill } from "./components/status";
export { Text, TextClassContext, type TextProps } from "./components/text";
export { cn } from "./lib/cn";
export { directionProps, type ReadingDirection } from "./lib/direction";
export {
  InfoKitThemeProvider,
  useInfoKitTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";
