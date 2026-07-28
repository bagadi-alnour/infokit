import {
  Platform,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

export type ReadingDirection = "ltr" | "rtl";

/**
 * Hands a subtree its reading direction on both platforms.
 *
 * The two runtimes disagree about where direction lives: Yoga takes it as the
 * `direction` layout style, react-native-web has no such style — it reads the
 * DOM `dir` attribute and logs the style as invalid. Sending both would print an
 * error on every render, so each platform gets only the one it understands.
 *
 * Pass any style the view already had as `style`: on native the direction has to
 * ride along inside it rather than replace it.
 */
export function directionProps(
  direction: ReadingDirection,
  style?: StyleProp<ViewStyle>,
): ViewProps {
  return Platform.OS === "web"
    ? // `dir` is a DOM attribute react-native-web forwards; RN's own prop types
      // have never heard of it.
      ({ dir: direction, style } as ViewProps)
    : { style: [style, { direction }] };
}
