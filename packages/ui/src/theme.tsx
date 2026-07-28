import { dark, light, type SemanticTheme } from "@infokit/tokens";
import { vars } from "nativewind";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme, View } from "react-native";

import { directionProps, type ReadingDirection } from "./lib/direction";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/**
 * Turns the semantic token set into the CSS variables the NativeWind preset
 * reads (`@infokit/ui/tailwind-preset`). `surfaceSubtle` becomes
 * `--infokit-surface-subtle`, matching the web injector one for one.
 */
function themeVariables(theme: SemanticTheme): Record<string, string> {
  return Object.fromEntries(
    Object.entries(theme).map(([key, value]) => [
      `--infokit-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      value,
    ]),
  );
}

const themes: Record<ResolvedTheme, SemanticTheme> = { light, dark };

interface InfoKitThemeValue {
  /** The set actually on screen — read this, do not read the device. */
  scheme: ResolvedTheme;
  /** Raw token values, for the few places RN needs a colour prop. */
  tokens: SemanticTheme;
  /**
   * The direction the reader reads in, which is the language they chose in the
   * app and not the one the phone is set to.
   */
  direction: ReadingDirection;
}

const InfoKitThemeContext = createContext<InfoKitThemeValue>({
  scheme: "light",
  tokens: light,
  direction: "ltr",
});

/**
 * Wraps the app in the resolved theme. Colours are injected as variables on a
 * root view, so every child styles itself with the semantic utilities
 * (`bg-surface`, `text-ink`) and nothing hardcodes a colour. The same root view
 * carries the reading direction, so choosing العربية mirrors every row below it
 * on the next frame — `I18nManager` could only do it on a relaunch, and it
 * follows the handset's language rather than the reader's.
 */
export function InfoKitThemeProvider({
  children,
  preference = "system",
  direction = "ltr",
}: {
  children: ReactNode;
  preference?: ThemePreference;
  direction?: ReadingDirection;
}) {
  const deviceScheme = useColorScheme();
  const scheme: ResolvedTheme =
    preference !== "system"
      ? preference
      : deviceScheme === "dark"
        ? "dark"
        : "light";
  const value = useMemo<InfoKitThemeValue>(
    () => ({ scheme, tokens: themes[scheme], direction }),
    [scheme, direction],
  );

  return (
    <InfoKitThemeContext.Provider value={value}>
      <View
        className="bg-canvas flex-1"
        {...directionProps(direction, vars(themeVariables(themes[scheme])))}
      >
        {children}
      </View>
    </InfoKitThemeContext.Provider>
  );
}

/**
 * The resolved scheme, its raw tokens (status bar, map tiles, charts) and the
 * reading direction.
 */
export function useInfoKitTheme(): InfoKitThemeValue {
  return useContext(InfoKitThemeContext);
}
