import { dark, light, type SemanticTheme } from "@infokit/tokens";
import { vars } from "nativewind";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme, View } from "react-native";

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
}

const InfoKitThemeContext = createContext<InfoKitThemeValue>({
  scheme: "light",
  tokens: light,
});

/**
 * Wraps the app in the resolved theme. Colours are injected as variables on a
 * root view, so every child styles itself with the semantic utilities
 * (`bg-surface`, `text-ink`) and nothing hardcodes a colour.
 */
export function InfoKitThemeProvider({
  children,
  preference = "system",
}: {
  children: ReactNode;
  preference?: ThemePreference;
}) {
  const deviceScheme = useColorScheme();
  const scheme: ResolvedTheme =
    preference !== "system"
      ? preference
      : deviceScheme === "dark"
        ? "dark"
        : "light";
  const value = useMemo<InfoKitThemeValue>(
    () => ({ scheme, tokens: themes[scheme] }),
    [scheme],
  );

  return (
    <InfoKitThemeContext.Provider value={value}>
      <View
        className="bg-canvas flex-1"
        style={vars(themeVariables(themes[scheme]))}
      >
        {children}
      </View>
    </InfoKitThemeContext.Provider>
  );
}

/** The resolved scheme and its raw tokens (status bar, map tiles, charts). */
export function useInfoKitTheme(): InfoKitThemeValue {
  return useContext(InfoKitThemeContext);
}
