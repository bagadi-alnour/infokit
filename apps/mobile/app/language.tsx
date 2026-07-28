import {
  localeMetadata,
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { Text, useInfoKitTheme } from "@infokit/ui";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { Pressable, ScrollView } from "react-native";

import { closeSheet } from "~/lib/close-sheet";
import { usePreferences } from "~/lib/preferences";

/**
 * The languages, each written in itself.
 *
 * Never "English (anglais)": someone looking for their own language finds it by
 * its own name and its own script, which is the only version of it they can be
 * expected to read (docs/DESIGN-SYSTEM.md §3). Choosing one closes the sheet —
 * the answer is the screen behind it, already in the new language.
 */
export default function LanguageScreen() {
  const router = useRouter();
  const { locale, setLocale } = usePreferences();

  const choose = (next: PublicLocale) => {
    setLocale(next);
    closeSheet(router);
  };

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerClassName="gap-2 p-4 pb-16"
    >
      {publicSupportedLocales.map((code) => (
        <LanguageRow
          key={code}
          code={code}
          selected={code === locale}
          onPress={() => {
            choose(code);
          }}
        />
      ))}
    </ScrollView>
  );
}

function LanguageRow({
  code,
  selected,
  onPress,
}: {
  code: PublicLocale;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens } = useInfoKitTheme();
  const meta = localeMetadata[code];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={meta.label}
      onPress={onPress}
      className={
        selected
          ? "border-brand bg-brand-soft rounded-card min-h-[56px] flex-row items-center justify-between gap-3 border px-4 py-3"
          : "border-line bg-surface rounded-card active:bg-subtle min-h-[56px] flex-row items-center justify-between gap-3 border px-4 py-3"
      }
    >
      <Text
        // Each name is laid out the way its own script reads.
        style={{ writingDirection: meta.direction }}
        className={selected ? "text-brand-soft-ink font-semibold" : undefined}
      >
        {meta.label}
      </Text>
      {selected ? (
        <Feather name="check" size={20} color={tokens.accentDeep} />
      ) : null}
    </Pressable>
  );
}
