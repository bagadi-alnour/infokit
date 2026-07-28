import { Text, useInfoKitTheme, type ThemePreference } from "@infokit/ui";
import Feather from "@expo/vector-icons/Feather";
import { Link } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { ForwardChevron } from "~/components/forward-chevron";
import { usePreferences } from "~/lib/preferences";

/**
 * Light, dark, or whatever the phone does.
 *
 * "Match the phone" is first and is the default: most readers have already made
 * this decision once, at the system level, and the app has no reason to ask them
 * to make it twice. The choice is remembered, so a borrowed handset set to a
 * blinding white at night can be fixed once.
 */
export default function AppearanceScreen() {
  const { theme, setTheme, strings } = usePreferences();

  const options: {
    value: ThemePreference;
    label: string;
    icon: "smartphone" | "sun" | "moon";
  }[] = [
    { value: "system", label: strings.themeSystem, icon: "smartphone" },
    { value: "light", label: strings.themeLight, icon: "sun" },
    { value: "dark", label: strings.themeDark, icon: "moon" },
  ];

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerClassName="gap-2 p-4 pb-16"
    >
      {options.map((option) => (
        <AppearanceRow
          key={option.value}
          label={option.label}
          icon={option.icon}
          selected={theme === option.value}
          onPress={() => {
            setTheme(option.value);
          }}
        />
      ))}

      {/* The component gallery is a build-time check of tokens and fonts, not a
          reader-facing page: it exists in development only. */}
      {__DEV__ ? (
        <Link href="/design-system" asChild>
          <Pressable
            accessibilityRole="link"
            className="active:bg-subtle rounded-card min-h-touch flex-row items-center justify-between gap-3 px-4 py-3"
          >
            <Text variant="muted">Système de design</Text>
            <ForwardChevron />
          </Pressable>
        </Link>
      ) : null}
    </ScrollView>
  );
}

function AppearanceRow({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: "smartphone" | "sun" | "moon";
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens } = useInfoKitTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={
        selected
          ? "border-brand bg-brand-soft rounded-card min-h-[56px] flex-row items-center gap-3 border px-4 py-3"
          : "border-line bg-surface rounded-card active:bg-subtle min-h-[56px] flex-row items-center gap-3 border px-4 py-3"
      }
    >
      <Feather
        name={icon}
        size={20}
        color={selected ? tokens.accentDeep : tokens.textMuted}
      />
      <View className="flex-1">
        <Text
          className={selected ? "text-brand-soft-ink font-semibold" : undefined}
        >
          {label}
        </Text>
      </View>
      {selected ? (
        <Feather name="check" size={20} color={tokens.accentDeep} />
      ) : null}
    </Pressable>
  );
}
