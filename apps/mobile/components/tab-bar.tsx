import { Text, useInfoKitTheme } from "@infokit/ui";
import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps, Ref } from "react";
import { Pressable, View } from "react-native";

type FeatherName = ComponentProps<typeof Feather>["name"];

/**
 * The four ordinary destinations. Each is a word *and* a shape: the label is
 * never dropped at small sizes, because an icon alone is a guess in a language
 * you do not read (docs/DESIGN-SYSTEM.md §1).
 */
export function TabButton({
  icon,
  label,
  isFocused,
  ref,
  href: _href,
  ...props
}: {
  icon: FeatherName;
  label: string;
  isFocused?: boolean;
  ref?: Ref<View>;
  /** `TabTrigger asChild` passes the resolved path; a Pressable has no use for it. */
  href?: string;
} & Omit<ComponentProps<typeof Pressable>, "children">) {
  const { tokens } = useInfoKitTheme();

  return (
    <Pressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      className="min-h-touch flex-1"
      {...props}
    >
      {/* The icon sits above the word in a box of our own that fills the cell:
          `TabTrigger asChild` hands the pressable a row whose children are
          spread apart, which would otherwise put the two side by side and push
          the pair to the start of the cell. */}
      <View className="flex-1 items-center justify-center gap-1 py-1.5">
        <Feather
          name={icon}
          size={22}
          color={isFocused ? tokens.accentDeep : tokens.textMuted}
        />
        <Text
          numberOfLines={1}
          className={
            isFocused
              ? "text-brand-deep text-xs font-semibold"
              : "text-copy-muted text-xs"
          }
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The map, raised out of the bar.
 *
 * It sits in the middle and above the row because "where is this" is the
 * question asked most often on the street, with one hand, while walking. The
 * label stays under it like the others — the shape is the emphasis, not a
 * mystery.
 */
export function MapTabButton({
  label,
  isFocused,
  ref,
  href: _href,
  ...props
}: {
  label: string;
  isFocused?: boolean;
  ref?: Ref<View>;
  href?: string;
} & Omit<ComponentProps<typeof Pressable>, "children">) {
  const { tokens } = useInfoKitTheme();

  return (
    <Pressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      className="min-h-touch flex-1 items-center justify-start"
      {...props}
      // Lifted clear of the bar it belongs to, without leaving its row. Set
      // after the spread: `TabTrigger asChild` passes a style of its own.
      style={{ marginTop: -26 }}
    >
      {/* Fills the cell so the shape sits in the middle of it, whichever way
          the trigger's own row lays its children out. */}
      <View className="flex-1 items-center">
        <View
          className={
            isFocused
              ? "bg-brand-hover border-surface h-14 w-14 items-center justify-center rounded-full border-4"
              : "bg-brand border-surface h-14 w-14 items-center justify-center rounded-full border-4"
          }
        >
          <Feather name="map" size={24} color={tokens.accentContrast} />
        </View>
        <Text numberOfLines={1} className="text-copy-muted mt-0.5 text-xs">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
