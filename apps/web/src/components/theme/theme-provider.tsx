"use client";

import { CalaisUIProvider, type CalaisColorTheme } from "@calais/ui";
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

export const themeStorageKey = "calais-info-theme";
export type ThemePreference = "system" | CalaisColorTheme;

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

function isThemePreference(
  value: string | undefined,
): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function CalaisThemeBridge({ children }: { children: ReactNode }) {
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

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );
  const calaisTheme: CalaisColorTheme =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <ThemePreferenceContext.Provider value={value}>
      <CalaisUIProvider theme={calaisTheme}>{children}</CalaisUIProvider>
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
      <CalaisThemeBridge>{children}</CalaisThemeBridge>
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
