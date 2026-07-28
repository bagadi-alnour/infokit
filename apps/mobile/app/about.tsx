import {
  localeMetadata,
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import type { StatusRole } from "@infokit/tokens";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Chip,
  MetaRow,
  StatusPill,
  Text,
} from "@infokit/ui";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { aboutStrings, type AboutSection } from "@infokit/shared/about";
import { closeSheet } from "~/lib/close-sheet";
import { usePreferences } from "~/lib/preferences";
import { welcomeStrings } from "~/lib/welcome-content";

/** The ramp in the order it is taught, not alphabetical: best case downwards. */
const statusOrder: StatusRole[] = ["open", "closed", "uncertain", "cancelled"];

/**
 * What InfoKit is, who writes what it shows, and what it does not ask for.
 *
 * The whole page is one long read on purpose: someone deciding whether to trust
 * an app about food and doctors deserves the entire answer in one scroll, in
 * their own language, rather than a marketing line and a link to a website they
 * may not be able to open.
 *
 * Two sections quote the app instead of describing it — the four status words
 * appear as real pills and the eleven languages as their own names — because the
 * page is also the place a reader comes to check what a pill on some other
 * screen meant.
 */
export default function AboutScreen() {
  const router = useRouter();
  const { locale, strings } = usePreferences();
  const about = aboutStrings(locale);
  const welcome = welcomeStrings(locale);
  // The version of the running build, or nothing: an app that invents a number
  // here is no help to whoever is reading a bug report (AGENTS.md rule 5).
  const version = Constants.expoConfig?.version;

  return (
    <>
      <Stack.Screen options={{ title: about.title }} />
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerClassName="gap-4 p-4 pb-16"
      >
        <View className="gap-1">
          <Text className="font-display text-ink text-3xl font-bold">
            InfoKit
          </Text>
          <Text variant="muted">{about.tagline}</Text>
        </View>

        <Text>{about.intro}</Text>

        <SectionCard section={about.what} />
        <SectionCard section={about.source} />
        <SectionCard section={about.freshness} />

        {/* The four words as they actually appear, glyph and colour included:
            the shortest way to explain a pill is to show the pill. */}
        <Card>
          <CardTitle>{about.statuses.title}</CardTitle>
          <CardDescription>{about.statuses.body}</CardDescription>
          {statusOrder.map((role) => (
            <View key={role} className="gap-1.5">
              <View className="flex-row">
                <StatusPill role={role} label={welcome.statusWords[role]} />
              </View>
              <Text variant="muted">{about.statuses.meanings[role]}</Text>
            </View>
          ))}
        </Card>

        {/* Each language in its own script and its own name — the one list on
            this page that needs no translating, and the one a reader can use
            even if they cannot read the paragraph above it. */}
        <Card>
          <CardTitle>{about.languages.title}</CardTitle>
          <CardDescription>{about.languages.body}</CardDescription>
          <View className="flex-row flex-wrap gap-2">
            {publicSupportedLocales.map((code: PublicLocale) => (
              <Chip key={code} label={localeMetadata[code].label} />
            ))}
          </View>
          <Button
            tone="outline"
            onPress={() => {
              router.push("/language");
            }}
          >
            <Text>{strings.language}</Text>
          </Button>
        </Card>

        {/* The same four things the welcome promised, in the same words: a
            promise that is worded twice is a promise a reader can doubt. */}
        <Card>
          <CardTitle>{about.privacy.title}</CardTitle>
          <CardDescription>{about.privacy.body}</CardDescription>
          <View className="gap-2">
            <Text variant="eyebrow">{welcome.visuals.neverAsked}</Text>
            {welcome.visuals.neverAskedItems.map((item) => (
              <Point key={item} text={item} />
            ))}
          </View>
        </Card>

        <SectionCard section={about.security} />
        <SectionCard section={about.cities} />
        <SectionCard section={about.collaboration} />
        <SectionCard section={about.associations} />

        {version ? (
          <Card>
            <MetaRow label={about.versionLabel}>{version}</MetaRow>
          </Card>
        ) : null}

        <Button
          tone="quiet"
          onPress={() => {
            closeSheet(router);
          }}
        >
          <Text>{strings.close}</Text>
        </Button>
      </ScrollView>
    </>
  );
}

/** Title, paragraph, and the short facts under it — the shape of every section. */
function SectionCard({ section }: { section: AboutSection }) {
  return (
    <Card>
      <CardTitle>{section.title}</CardTitle>
      <CardDescription>{section.body}</CardDescription>
      {section.points.length > 0 ? (
        <View className="gap-2">
          {section.points.map((point) => (
            <Point key={point} text={point} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** The welcome's bullet, so a fact reads the same on both screens. */
function Point({ text }: { text: string }) {
  return (
    <View className="flex-row gap-2.5">
      <Text className="text-brand-deep font-semibold">·</Text>
      <Text className="flex-1">{text}</Text>
    </View>
  );
}
