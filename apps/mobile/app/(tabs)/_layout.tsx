import { useInfoKitTheme } from "@infokit/ui";
import { Redirect } from "expo-router";
import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "~/components/app-header";
import { MapTabButton, TabButton } from "~/components/tab-bar";
import { usePreferences } from "~/lib/preferences";

/**
 * What a visitor who has signed in to nothing can reach: home, now, the map,
 * the guide, the articles — in that order, with the map raised in the middle.
 *
 * This is the headless tab list rather than a themed navigator, because the bar
 * has one element that does not fit a row of equals: the map is the question
 * asked most often on the street, so it is a shape above the bar and not a fifth
 * icon in it. Everything else stays a plain, labelled 48px target. The agenda is
 * reached from home rather than from here — it is the one destination a member
 * reads differently from a visitor, and the bar is the visitor's.
 */
export default function TabsLayout() {
  const { strings, welcomeDone } = usePreferences();
  const { direction } = useInfoKitTheme();
  const insets = useSafeAreaInsets();

  // The welcome flow comes before the first request: there is no point loading
  // published content in a language the reader has not chosen yet.
  if (!welcomeDone) return <Redirect href="/welcome" />;

  return (
    <Tabs>
      <View className="flex-1">
        <AppHeader />
        {/* Bounded on purpose: the slot's own style grows with its content, and
            a screen taller than the window would then scroll the window instead
            of the screen, leaving the tab bar behind. */}
        <TabSlot style={{ flex: 1 }} />
      </View>
      <TabList asChild>
        <View
          // Read in the direction the language is read: home belongs at the edge
          // a reader starts from, which in Arabic is the right one.
          className={`bg-surface border-line items-start border-t px-1 pt-2 ${
            direction === "rtl" ? "flex-row-reverse" : "flex-row"
          }`}
          style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        >
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="home" label={strings.tabHome} />
          </TabTrigger>
          <TabTrigger name="now" href="/now" asChild>
            <TabButton icon="clock" label={strings.tabNow} />
          </TabTrigger>
          <TabTrigger name="map" href="/map" asChild>
            <MapTabButton label={strings.tabMap} />
          </TabTrigger>
          <TabTrigger name="guides" href="/guides" asChild>
            <TabButton icon="compass" label={strings.tabGuide} />
          </TabTrigger>
          <TabTrigger name="articles" href="/articles" asChild>
            <TabButton icon="book-open" label={strings.tabArticles} />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}
