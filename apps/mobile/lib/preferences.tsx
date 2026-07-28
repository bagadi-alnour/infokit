import { isPublicLocale, type PublicLocale } from "@infokit/shared/i18n";
import type { ThemePreference } from "@infokit/ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { appStrings, type AppStrings } from "./app-strings";
import { deviceLocale } from "./client";
import { readStored, writeStored } from "./store";

/**
 * The two choices a reader makes about the app itself.
 *
 * Language is first-class here rather than taken from the phone: someone using
 * a borrowed or second-hand handset set to another language still has to be
 * able to read this. The choice is remembered, and until one is made the device
 * language decides (docs/DESIGN-SYSTEM.md §3).
 */
interface PreferencesValue {
  locale: PublicLocale;
  /** True once the stored choices have been read — the app waits for this. */
  ready: boolean;
  theme: ThemePreference;
  /** The app's own furniture, in the chosen language. */
  strings: AppStrings;
  setLocale: (locale: PublicLocale) => void;
  setTheme: (theme: ThemePreference) => void;
  /** False while the welcome flow still owes the reader its first screen. */
  welcomeDone: boolean;
  completeWelcome: () => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

/**
 * In development the welcome plays on every launch, because it is being worked
 * on and has to be readable without wiping the app. In a real build it plays
 * once: the "seen" flag is written to the store like the other two choices.
 *
 * `EXPO_PUBLIC_INFOKIT_WELCOME=once` rehearses the real behaviour from a dev
 * build — the one thing a first-run flow cannot be tested for by running it
 * again is that it stops running.
 */
export const showWelcomeOnEveryLaunch =
  __DEV__ && process.env.EXPO_PUBLIC_INFOKIT_WELCOME !== "once";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PublicLocale>(() => deviceLocale());
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let current = true;
    const load = async () => {
      const [storedLocale, storedTheme, storedWelcome] = await Promise.all([
        readStored("locale"),
        readStored("theme"),
        readStored("welcome"),
      ]);
      if (!current) return;
      if (isPublicLocale(storedLocale)) setLocaleState(storedLocale);
      if (isThemePreference(storedTheme)) setThemeState(storedTheme);
      if (!showWelcomeOnEveryLaunch && storedWelcome === "yes") {
        setWelcomeDone(true);
      }
      setReady(true);
    };
    void load();
    return () => {
      current = false;
    };
  }, []);

  const setLocale = useCallback((next: PublicLocale) => {
    setLocaleState(next);
    void writeStored("locale", next);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    void writeStored("theme", next);
  }, []);

  const completeWelcome = useCallback(() => {
    setWelcomeDone(true);
    if (!showWelcomeOnEveryLaunch) void writeStored("welcome", "yes");
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({
      locale,
      ready,
      theme,
      strings: appStrings(locale),
      setLocale,
      setTheme,
      welcomeDone,
      completeWelcome,
    }),
    [locale, ready, theme, setLocale, setTheme, welcomeDone, completeWelcome],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value)
    throw new Error("usePreferences needs PreferencesProvider above.");
  return value;
}
