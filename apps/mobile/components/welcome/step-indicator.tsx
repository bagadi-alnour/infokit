import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { fill, type WelcomeStrings } from "~/lib/welcome-content";

/**
 * One dot, its width and its fill tied to how far the pager is from it.
 *
 * The dot answers the swipe rather than the settled page: a reader dragging
 * halfway between two pages sees the flow itself move, which is what tells them
 * the gesture is doing something before the page has changed.
 *
 * Reanimated drives width and opacity only; both colours stay on plain child
 * views, which is both AGENTS.md rule 1 and a requirement — an element handed an
 * animated `style` loses its `className` entirely.
 */
function Dot({
  index,
  progress,
}: {
  index: number;
  progress: SharedValue<number>;
}) {
  const track = useAnimatedStyle<ViewStyle>(() => ({
    width: interpolate(
      Math.min(Math.abs(progress.value - index), 1),
      [0, 1],
      [20, 6],
    ),
  }));
  const fillStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: 1 - Math.min(Math.abs(progress.value - index), 1),
  }));

  return (
    <Animated.View style={track}>
      <View className="bg-line-strong h-1.5 w-full overflow-hidden rounded-full">
        <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
          <View className="bg-brand h-full w-full" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** Where the reader is in the flow, and how much of it is left. */
export function StepIndicator({
  step,
  total,
  progress,
  strings,
  className,
}: {
  step: number;
  total: number;
  /** The pager position in pages, in reading order. */
  progress: SharedValue<number>;
  strings: WelcomeStrings;
  className?: string;
}) {
  return (
    <View
      className={`flex-row items-center justify-center gap-1.5 ${className ?? ""}`}
      accessibilityRole="progressbar"
      accessibilityLabel={fill(strings.stepOf, { step: step + 1, total })}
    >
      {Array.from({ length: total }, (_, index) => (
        <Dot key={index} index={index} progress={progress} />
      ))}
    </View>
  );
}
