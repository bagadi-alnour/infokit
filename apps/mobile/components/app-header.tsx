import { brandName, localeMetadata } from "@infokit/shared/i18n";
import { Text, useInfoKitTheme } from "@infokit/ui";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { aboutStrings } from "@infokit/shared/about";
import { useClock } from "~/lib/use-clock";
import { usePreferences } from "~/lib/preferences";
import { useSession } from "~/lib/session";

/**
 * The one row above every tab.
 *
 * The clock is not decoration: this app answers "is it open now", and a reader
 * has to be able to see which hour that answer is about. Next to it sit the two
 * things a borrowed phone gets wrong — the language and the brightness — and the
 * members' door, which is a person, never a banner over public content.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, strings } = usePreferences();
  const { state } = useSession();
  const { tokens } = useInfoKitTheme();
  const time = useClock(locale);
  const about = aboutStrings(locale);
  const identity = state.status === "signedIn" ? state.identity : null;

  return (
    <View
      className="bg-surface border-line border-b"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center justify-between gap-2 px-4 py-2">
        <View className="flex-row items-center gap-1">
          {/* The name opens the About page. A fourth 48pt button would crowd a
              375pt row, and "what is this app, and who writes it?" is a question
              a reader asks of the name — the small mark says it can be tapped. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={about.title}
            onPress={() => {
              router.push("/about");
            }}
            className="min-h-touch rounded-control active:bg-subtle -ml-2 flex-row items-center gap-1.5 px-2"
          >
            <Text className="font-display text-ink text-lg font-bold">
              {brandName(locale)}
            </Text>
            {/* A full circled i, at the size of the other header glyphs: at 14pt
                it read as a speck of punctuation rather than something to press. */}
            <Feather name="info" size={20} color={tokens.textMuted} />
          </Pressable>
          {/* Its own text node, and left-to-right: a time next to Arabic script
              must not be split by a separator (docs/DESIGN-SYSTEM.md §3). */}
          <Text
            className="text-copy-muted text-base tabular-nums"
            accessibilityLabel={time}
          >
            {time}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <HeaderButton
            label={`${strings.language} — ${localeMetadata[locale].label}`}
            onPress={() => {
              router.push("/language");
            }}
          >
            <Text className="text-brand-deep text-sm font-semibold uppercase">
              {locale}
            </Text>
          </HeaderButton>

          <HeaderButton
            label={strings.theme}
            onPress={() => {
              router.push("/appearance");
            }}
          >
            <Feather name="moon" size={20} color={tokens.textMuted} />
          </HeaderButton>

          <HeaderButton
            label={identity ? identity.labels.account : strings.members}
            onPress={() => {
              router.push(identity ? "/account" : "/sign-in");
            }}
          >
            {identity ? (
              <Text className="text-brand-deep text-sm font-semibold">
                {identity.initials}
              </Text>
            ) : (
              <Feather name="user" size={20} color={tokens.textMuted} />
            )}
          </HeaderButton>
        </View>
      </View>
    </View>
  );
}

/** 48×48 whatever is inside it — the public target size, header included. */
function HeaderButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-touch rounded-control active:bg-subtle h-12 w-12 items-center justify-center"
    >
      {children}
    </Pressable>
  );
}
