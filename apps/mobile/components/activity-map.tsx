import { statusRoleTokens } from "@infokit/tokens";
import { Button, Text, useInfoKitTheme } from "@infokit/ui";
import { useMemo, useState } from "react";
import { Platform, View } from "react-native";
import MapView, {
  Marker,
  type MapStyleElement,
  type Region,
} from "react-native-maps";

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
 * Android's Google map does not follow the device appearance setting. Build
 * its map palette from the same semantic roles as the rest of the app so a
 * theme change cannot leave a bright rectangle in the middle of a dark screen.
 * Apple Maps uses `userInterfaceStyle` instead and ignores this prop.
 */
function googleMapStyle(
  tokens: ReturnType<typeof useInfoKitTheme>["tokens"],
): MapStyleElement[] {
  return [
    {
      elementType: "geometry",
      stylers: [{ color: tokens.mapCanvas }],
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: tokens.textMuted }],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: tokens.surface }],
    },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: tokens.borderStrong }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: tokens.surface }],
    },
    {
      featureType: "poi.business",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: tokens.surface }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: tokens.border }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: tokens.accentSoft }],
    },
    {
      featureType: "transit.line",
      elementType: "geometry",
      stylers: [{ color: tokens.borderStrong }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: tokens.canvas }],
    },
  ];
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
  viewLabels,
}: ActivityMapProps) {
  const { scheme, tokens } = useInfoKitTheme();
  const customMapStyle = useMemo(() => googleMapStyle(tokens), [tokens]);
  const [mapStyle, setMapStyle] = useState<"muted" | "hybrid">("muted");
  const mapType =
    mapStyle === "hybrid"
      ? "hybrid"
      : Platform.OS === "ios"
        ? "mutedStandard"
        : "standard";

  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        initialRegion={regionFor(activities)}
        mapType={mapType}
        customMapStyle={mapStyle === "muted" ? customMapStyle : undefined}
        userInterfaceStyle={scheme}
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
      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 top-0 items-center px-3 pt-3"
      >
        <View
          accessibilityRole="tablist"
          accessibilityLabel={viewLabels.group}
          className="bg-surface border-line rounded-control flex-row gap-1 border p-1"
        >
          <Button
            block={false}
            tone={mapStyle === "muted" ? "outline" : "quiet"}
            accessibilityRole="tab"
            accessibilityState={{ selected: mapStyle === "muted" }}
            className="px-3"
            onPress={() => {
              setMapStyle("muted");
            }}
          >
            <Text>{viewLabels.muted}</Text>
          </Button>
          <Button
            block={false}
            tone={mapStyle === "hybrid" ? "outline" : "quiet"}
            accessibilityRole="tab"
            accessibilityState={{ selected: mapStyle === "hybrid" }}
            className="px-3"
            onPress={() => {
              setMapStyle("hybrid");
            }}
          >
            <Text>{viewLabels.hybrid}</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
