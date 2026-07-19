"use client";

import { CalaisUIProvider, type CalaisColorTheme } from "@calais/ui";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

export const themeStorageKey = "calais-info-theme";
export type ThemePreference = "system" | CalaisColorTheme;

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function preferredSystemTheme(): CalaisColorTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemTheme, setSystemTheme] = useState<CalaisColorTheme>("light");
  const [preferenceReady, setPreferenceReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const synchronizeSystemTheme = () => {
      setSystemTheme(preferredSystemTheme());
    };
    const stored = window.localStorage.getItem(themeStorageKey);
    const initialPreference = isThemePreference(stored) ? stored : "system";

    setPreferenceState(initialPreference);
    document.documentElement.dataset.theme = initialPreference;
    synchronizeSystemTheme();
    setPreferenceReady(true);
    media.addEventListener("change", synchronizeSystemTheme);
    return () => {
      media.removeEventListener("change", synchronizeSystemTheme);
    };
  }, []);

  // A locale change replaces attributes owned by the dynamic root layout.
  // Restore the client preference before paint so CSS variables and Tamagui
  // never resolve different themes during navigation.
  useLayoutEffect(() => {
    if (!preferenceReady) return;
    document.documentElement.dataset.theme = preference;
  }, [pathname, preference, preferenceReady]);

  const setPreference = (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    document.documentElement.dataset.theme = nextPreference;
    window.localStorage.setItem(themeStorageKey, nextPreference);
  };

  const value = useMemo(() => ({ preference, setPreference }), [preference]);
  const resolvedTheme = preference === "system" ? systemTheme : preference;

  return (
    <ThemePreferenceContext.Provider value={value}>
      <CalaisUIProvider theme={resolvedTheme}>{children}</CalaisUIProvider>
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error("useThemePreference must be used within ThemeProvider");
  }
  return context;
}
