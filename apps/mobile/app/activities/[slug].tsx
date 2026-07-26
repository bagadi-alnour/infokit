import type { PublicActivityDetailPayload } from "@infokit/shared/public-content";
import {
  Button,
  Callout,
  Card,
  CardDescription,
  CardTitle,
  Chip,
  MetaRow,
  StatusPill,
  Text,
} from "@infokit/ui";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { Image, RefreshControl, ScrollView, View } from "react-native";

import { ErrorState, LoadingState } from "~/components/request-states";
import { connectionStrings, deviceLocale, publicClient } from "~/lib/client";
import { usePublicPayload } from "~/lib/use-public-payload";

function ActivityDetail({ payload }: { payload: PublicActivityDetailPayload }) {
  const { activity, labels } = payload;
  const statusWords = {
    open: labels.statusOpen,
    closed: labels.statusClosed,
    cancelled: labels.statusCancelled,
    uncertain: labels.statusUncertain,
  };
  const cover = activity.coverImage;
  // Read once: a closure cannot rely on narrowing a property access.
  const mapHref = activity.mapHref;

  return (
    <>
      {cover ? (
        <Image
          source={{ uri: publicClient.resolveUrl(cover.url) }}
          className="rounded-card bg-subtle h-44 w-full"
          resizeMode="cover"
          // A decorative image says nothing a screen reader needs to hear.
          accessible={!cover.decorative}
          accessibilityLabel={cover.decorative ? undefined : cover.alt}
        />
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        <StatusPill
          role={activity.status}
          label={statusWords[activity.status]}
          detail={activity.nextOpeningLabel ?? undefined}
        />
        <Chip label={activity.categoryLabel} />
      </View>

      <View className="gap-2">
        <Text variant="title">{activity.name}</Text>
        <Text className="text-copy-muted">{activity.shortDescription}</Text>
      </View>

      {activity.fallbackUsed ? (
        <Callout tone="info">{activity.fallbackLabel}</Callout>
      ) : null}

      <Card>
        <CardTitle>{labels.schedule}</CardTitle>
        {activity.scheduleLabels.map((label) => (
          <Text key={label}>{label}</Text>
        ))}
        <Text variant="muted">
          {labels.lastVerified} · {activity.lastVerifiedLabel}
        </Text>
      </Card>

      <Card>
        <CardTitle>{labels.place}</CardTitle>
        <Text>{activity.placeName}</Text>
        {activity.address ? (
          <CardDescription>{activity.address}</CardDescription>
        ) : null}
        {mapHref ? (
          <Button
            tone="outline"
            onPress={() => {
              // The map opens outside the app: no location leaves the phone.
              void Linking.openURL(mapHref);
            }}
          >
            <Text>{labels.mapView}</Text>
          </Button>
        ) : (
          <Text variant="muted">{labels.noMap}</Text>
        )}
      </Card>

      {labels.audience ? (
        <Card>
          <MetaRow label={labels.audience}>{activity.audienceLabel}</MetaRow>
          {activity.services.length > 0 ? (
            <>
              <Text variant="eyebrow">{labels.services}</Text>
              <View className="flex-row flex-wrap gap-2">
                {activity.services.map((service) => (
                  <Chip key={service.id} label={service.label} />
                ))}
              </View>
            </>
          ) : null}
          {activity.providerNames.length > 0 ? (
            <MetaRow label={labels.provider}>
              {activity.providerNames.join(" · ")}
            </MetaRow>
          ) : null}
        </Card>
      ) : null}

      {activity.description ? (
        <Card>
          <Text>{activity.description}</Text>
        </Card>
      ) : null}

      {activity.instructions && labels.instructions ? (
        <Card>
          <CardTitle>{labels.instructions}</CardTitle>
          <Text>{activity.instructions}</Text>
        </Card>
      ) : null}
    </>
  );
}

export default function ActivityDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = useMemo(() => deviceLocale(), []);
  const strings = useMemo(() => connectionStrings(locale), [locale]);
  const load = useCallback(
    (signal: AbortSignal) => publicClient.getActivity(slug, { locale, signal }),
    [slug, locale],
  );
  const { state, refreshing, refresh, retry } = usePublicPayload(load);
  const payload = state.status === "ready" ? state.payload : null;

  return (
    <>
      <Stack.Screen options={{ title: payload?.activity.name ?? "InfoKit" }} />
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerClassName="gap-5 p-4 pb-10"
        style={payload ? { direction: payload.direction } : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {payload ? <ActivityDetail payload={payload} /> : null}

        {state.status === "loading" ? <LoadingState strings={strings} /> : null}
        {/* A published activity can be unpublished while someone reads it. */}
        {state.status === "ready" && !payload ? (
          <Callout tone="warning">{strings.notFound}</Callout>
        ) : null}
        {state.status === "error" ? (
          <ErrorState
            strings={strings}
            unreachable={state.unreachable}
            onRetry={retry}
          />
        ) : null}
      </ScrollView>
    </>
  );
}
