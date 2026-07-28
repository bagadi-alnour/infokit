import { View } from "react-native";

import type { ActivityMapProps } from "./activity-map-props";

export type { PlacedActivity } from "./activity-map-props";

/**
 * The map has no web build: `react-native-maps` is a native view, and the web
 * bundle exists only for development. The surface is left empty rather than
 * filled with a stand-in message — the screen already carries the hint below it,
 * and inventing a second sentence here would put words in the app that no
 * reader of the real app ever sees.
 */
export function ActivityMap(_props: ActivityMapProps) {
  return <View className="bg-subtle flex-1" />;
}
