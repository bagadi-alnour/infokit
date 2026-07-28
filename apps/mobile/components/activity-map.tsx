import { statusRoleTokens } from "@infokit/tokens";
import { useInfoKitTheme } from "@infokit/ui";
import MapView, { Marker, type Region } from "react-native-maps";

import type { ActivityMapProps, PlacedActivity } from "./activity-map-props";

export type { PlacedActivity } from "./activity-map-props";

/** Keeps every pin on screen with room to breathe, whatever the city. */
function regionFor(activities: PlacedActivity[]): Region {
  const latitudes = activities.map((activity) => activity.latitude);
  const longitudes = activities.map((activity) => activity.longitude);
  const north = Math.max(...latitudes);
  const south = Math.min(...latitudes);
  const east = Math.max(...longitudes);
  const west = Math.min(...longitudes);
  return {
    latitude: (north + south) / 2,
    longitude: (east + west) / 2,
    // A single pin has no span of its own, so it gets a street-level one.
    latitudeDelta: Math.max((north - south) * 1.6, 0.02),
    longitudeDelta: Math.max((east - west) * 1.6, 0.02),
  };
}

/**
 * The pins, and nothing else.
 *
 * The map answers one question — what is around here — so a pin carries only the
 * name and the state word; everything else waits for the card underneath. The
 * reader's own position is never asked for: this is a map of published places,
 * not a tracker.
 */
export function ActivityMap({
  activities,
  selectedId,
  onSelect,
  statusWord,
}: ActivityMapProps) {
  const { tokens } = useInfoKitTheme();

  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={regionFor(activities)}
      showsUserLocation={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      onPress={() => {
        onSelect(null);
      }}
    >
      {activities.map((activity) => (
        <Marker
          key={activity.id}
          identifier={activity.id}
          coordinate={{
            latitude: activity.latitude,
            longitude: activity.longitude,
          }}
          title={activity.name}
          description={statusWord(activity)}
          // The pin borrows the status role's own colour rather than choosing
          // one, and the word travels with it in the callout.
          pinColor={tokens[statusRoleTokens[activity.status].fg]}
          onPress={() => {
            onSelect(activity.id === selectedId ? null : activity.id);
          }}
        />
      ))}
    </MapView>
  );
}
