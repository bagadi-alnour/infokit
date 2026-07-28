import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * The only reason a page moves on its own, made visible. A carousel that
 * advances without saying when is a page that disappears mid-sentence; the bar
 * is the promise that the reader can see it coming — and it disappears entirely
 * once the reader takes control or asks for less motion.
 */
export function AutoAdvanceBar({
  running,
  duration,
  resetKey,
}: {
  running: boolean;
  duration: number;
  resetKey: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (running) progress.value = withTiming(1, { duration });
  }, [progress, running, duration, resetKey]);

  // A width rather than a `scaleX`, because the bar has to fill towards the end
  // of the line in Arabic and Persian too: laid out in the parent's direction,
  // a growing width starts where the reading starts. The assertion says which
  // half of `DimensionValue` this string is. The colour stays on a child view:
  // an element given an animated `style` loses its `className`.
  const grow = useAnimatedStyle<ViewStyle>(() => ({
    width: `${String(progress.value * 100)}%` as `${number}%`,
  }));

  return (
    <View
      className="bg-line-strong h-1 flex-1 overflow-hidden rounded-full"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {running ? (
        <Animated.View style={grow}>
          <View className="bg-brand h-1 w-full" />
        </Animated.View>
      ) : null}
    </View>
  );
}
