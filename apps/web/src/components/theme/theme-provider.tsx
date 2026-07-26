"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import {
  useCallback,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const themeStorageKey = "infokit-theme";
export type ColorScheme = "light" | "dark";
export type ThemePreference = "system" | ColorScheme;

interface ThemePreferenceContextValue {
  /** What the reader chose, including "system". */
  preference: ThemePreference;
  /** What is actually painted right now. */
  resolved: ColorScheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

function isThemePreference(
  value: string | undefined,
): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function ThemePreferenceBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // next-themes reads localStorage after mount. Keep the server and the first
  // client render identical, then reveal the stored preference.
  const preference = mounted && isThemePreference(theme) ? theme : "system";
  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      setTheme(nextPreference);
    },
    [setTheme],
  );
  const resolved: ColorScheme =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      storageKey={themeStorageKey}
    >
      <ThemePreferenceBridge>{children}</ThemePreferenceBridge>
    </NextThemesProvider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error("useThemePreference must be used within ThemeProvider");
  }
  return context;
}
