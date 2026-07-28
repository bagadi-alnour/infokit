import { localeMetadata } from "@infokit/shared/i18n";
import { InfoKitThemeProvider, useInfoKitTheme } from "@infokit/ui";
import { NotoSansArabic_400Regular } from "@expo-google-fonts/noto-sans-arabic";
import {
  PublicSans_400Regular,
  PublicSans_600SemiBold,
} from "@expo-google-fonts/public-sans";
import { WorkSans_700Bold } from "@expo-google-fonts/work-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { aboutStrings } from "@infokit/shared/about";
import { PreferencesProvider, usePreferences } from "~/lib/preferences";
import { SessionProvider } from "~/lib/session";

import "../global.css";

/**
 * The families are registered under the exact names the NativeWind preset asks
 * for (`font-display`, `font-body`, `font-arabic` → `fontFamilies` in
 * @infokit/tokens), so a screen only ever names a class. On native each weight
 * is its own face, so headings register the bold cut directly.
 */
const fonts = {
  "Work Sans": WorkSans_700Bold,
  "Public Sans": PublicSans_400Regular,
  "Public Sans SemiBold": PublicSans_600SemiBold,
  "Noto Sans Arabic": NotoSansArabic_400Regular,
};

/**
 * Everything below the preferences: the theme they choose wraps the navigator,
 * so a screen only ever names a semantic utility. Until the stored choices have
 * been read the app shows nothing — one frame in the device language followed by
 * a swap to the remembered one is worse than a slightly later first frame.
 *
 * The session sits inside the theme and outside the navigator, because the
 * header asks it who is reading on every screen, and a deep link carrying a
 * sign-in code can arrive before any screen has mounted.
 */
function ThemedApp() {
  const { theme, locale, ready } = usePreferences();

  if (!ready) return null;

  return (
    // The reading direction is the chosen language's, not the handset's: this
    // app is read on borrowed phones, and `I18nManager` would need a relaunch.
    <InfoKitThemeProvider
      preference={theme}
      direction={localeMetadata[locale].direction}
    >
      <SessionProvider>
        <Navigation />
      </SessionProvider>
    </InfoKitThemeProvider>
  );
}

function Navigation() {
  const { scheme, tokens } = useInfoKitTheme();
  const { locale, strings } = usePreferences();
  // The one sheet whose own title is translated in all eleven languages, not
  // three: "what is this app" is asked in the reader's language or not at all.
  const about = aboutStrings(locale);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.surface },
          headerTitleStyle: { color: tokens.ink },
          headerTintColor: tokens.accentDeep,
          contentStyle: { backgroundColor: tokens.canvas },
        }}
      >
        {/* The tab shell carries its own header row; the welcome flow is a
            screen of its own with nothing above it. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        {/* Choices and the members' door arrive as sheets: each one answers a
            question the reader just asked, rather than being another place to
            get lost in. */}
        <Stack.Screen
          name="language"
          options={{ presentation: "modal", title: strings.languageTitle }}
        />
        <Stack.Screen
          name="appearance"
          options={{ presentation: "modal", title: strings.theme }}
        />
        <Stack.Screen
          name="sign-in"
          options={{ presentation: "modal", title: strings.members }}
        />
        <Stack.Screen name="account" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="about"
          options={{ presentation: "modal", title: about.title }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fonts);

  // Render nothing until the faces are in memory: swapping them mid-read moves
  // the text under the reader's finger (docs/DESIGN-SYSTEM.md §2).
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <ThemedApp />
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
