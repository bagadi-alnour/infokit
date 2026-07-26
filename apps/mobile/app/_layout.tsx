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

function Navigation() {
  const { scheme, tokens } = useInfoKitTheme();

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
      />
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
      <InfoKitThemeProvider>
        <Navigation />
      </InfoKitThemeProvider>
    </SafeAreaProvider>
  );
}
