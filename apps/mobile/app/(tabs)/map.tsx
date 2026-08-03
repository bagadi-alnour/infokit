import { Button, Callout, CardTitle, StatusPill, Text } from "@infokit/ui";
import { Link } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { ActivityMap, type PlacedActivity } from "~/components/activity-map";
import { ActivityCardFrame, statusLabel } from "~/components/content-cards";
import { ErrorState, LoadingState } from "~/components/request-states";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

/**
 * Where the places are.
 *
 * This is the middle of the tab bar because "where is this" is the question
 * asked most often on the street, one-handed, while walking. Only activities with
 * an exact location appear: a pin dropped on a city centre because the address
 * was vague would send someone to the wrong door, so those stay in the list.
 */
export default function MapScreen() {
  const { locale, strings } = usePreferences();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const load = useCallback(
    (signal: AbortSignal) => publicClient.listActivities({ locale, signal }),
    [locale],
  );
  const { state, retry } = usePublicPayload(load);

  if (state.status === "loading") {
    return (
      <View className="bg-canvas flex-1 justify-center">
        <LoadingState strings={strings} />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View className="bg-canvas flex-1 justify-center p-4">
        <ErrorState
          strings={strings}
          unreachable={state.unreachable}
          onRetry={retry}
        />
      </View>
    );
  }

  const { activities, labels } = state.payload;
  const placed = activities.filter(
    (activity): activity is PlacedActivity =>
      activity.latitude !== null && activity.longitude !== null,
  );
  const selected =
    placed.find((activity) => activity.id === selectedId) ?? null;

  return (
    <View className="bg-canvas flex-1">
      {placed.length === 0 ? (
        <View className="flex-1 justify-center p-4">
          <Callout tone="info" title={labels.mapTitle}>
            {labels.noMap}
          </Callout>
        </View>
      ) : (
        <ActivityMap
          activities={placed}
          selectedId={selectedId}
          onSelect={setSelectedId}
          statusWord={(activity) => statusLabel(activity.status, labels)}
          viewLabels={{
            group: strings.mapStyle,
            muted: strings.mapMuted,
            hybrid: strings.mapHybrid,
          }}
          hint={labels.mapHint}
        />
      )}

      {/* The card sits over the map rather than beside it: on a phone the map is
          the screen, and the answer belongs on top of the place it is about. */}
      <View className="absolute inset-x-0 bottom-0 p-3">
        {selected ? (
          <ActivityCardFrame status={selected.status}>
            <View className="flex-row flex-wrap items-center gap-2">
              <StatusPill
                role={selected.status}
                label={statusLabel(selected.status, labels)}
                detail={selected.nextOpeningLabel ?? undefined}
              />
            </View>
            <CardTitle>{selected.name}</CardTitle>
            <Text variant="muted">{selected.placeName}</Text>
            <Link
              href={{
                pathname: "/activities/[slug]",
                params: { slug: selected.slug },
              }}
              asChild
            >
              <Button tone="outline">
                <Text>{labels.open}</Text>
              </Button>
            </Link>
          </ActivityCardFrame>
        ) : placed.length > 0 ? (
          <View className="bg-surface border-line rounded-card border px-4 py-3">
            <Text variant="muted">{labels.mapHint}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
