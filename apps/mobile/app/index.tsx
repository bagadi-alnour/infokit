import type {
  PublicActivityLabels,
  PublicActivityStatus,
  PublicActivitySummary,
} from "@infokit/shared/public-content";
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
import { Link, Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { ErrorState, LoadingState } from "~/components/request-states";
import { connectionStrings, deviceLocale, publicClient } from "~/lib/client";
import { usePublicPayload } from "~/lib/use-public-payload";

function statusLabel(
  status: PublicActivityStatus,
  labels: PublicActivityLabels,
): string {
  const words: Record<PublicActivityStatus, string> = {
    open: labels.statusOpen,
    closed: labels.statusClosed,
    cancelled: labels.statusCancelled,
    uncertain: labels.statusUncertain,
  };
  return words[status];
}

/**
 * One published activity, in the fixed reading order of docs/DESIGN-SYSTEM.md
 * §1: state → what it is → where → for whom → how fresh. Every string arrives
 * localized from the server, so this card formats nothing.
 */
function ActivityCard({
  activity,
  labels,
}: {
  activity: PublicActivitySummary;
  labels: PublicActivityLabels;
}) {
  return (
    <Card>
      <View className="flex-row flex-wrap items-center gap-2">
        <StatusPill
          role={activity.status}
          label={statusLabel(activity.status, labels)}
          detail={activity.nextOpeningLabel ?? undefined}
        />
        <Chip label={activity.categoryLabel} />
      </View>
      <CardTitle>{activity.name}</CardTitle>
      <CardDescription>{activity.shortDescription}</CardDescription>
      <MetaRow label={labels.place}>{activity.placeName}</MetaRow>
      {labels.audience ? (
        <MetaRow label={labels.audience}>{activity.audienceLabel}</MetaRow>
      ) : null}
      <MetaRow label={labels.schedule}>
        {activity.scheduleLabels.join(" · ")}
      </MetaRow>
      {activity.fallbackUsed ? (
        <Text variant="muted">{activity.fallbackLabel}</Text>
      ) : null}
      <Text variant="muted">
        {labels.lastVerified} · {activity.lastVerifiedLabel}
      </Text>
      <Link
        href={{
          pathname: "/activities/[slug]",
          params: { slug: activity.slug },
        }}
        asChild
      >
        <Button tone="outline">
          <Text>{labels.open}</Text>
        </Button>
      </Link>
    </Card>
  );
}

export default function HomeScreen() {
  const locale = useMemo(() => deviceLocale(), []);
  const strings = useMemo(() => connectionStrings(locale), [locale]);
  const load = useCallback(
    (signal: AbortSignal) => publicClient.listActivities({ locale, signal }),
    [locale],
  );
  const { state, refreshing, refresh, retry } = usePublicPayload(load);
  const payload = state.status === "ready" ? state.payload : null;

  return (
    <>
      <Stack.Screen options={{ title: "InfoKit" }} />
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerClassName="gap-5 p-4 pb-10"
        style={payload ? { direction: payload.direction } : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {payload ? (
          <>
            <View className="gap-2">
              <Text variant="eyebrow">{payload.page.eyebrow}</Text>
              <Text variant="title">{payload.page.title}</Text>
              <Text className="text-copy-muted">
                {payload.page.description}
              </Text>
            </View>

            <Callout tone="info">{payload.page.freshnessNotice}</Callout>

            {payload.activities.length === 0 ? (
              <Text variant="muted">{payload.labels.empty}</Text>
            ) : (
              payload.activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  labels={payload.labels}
                />
              ))
            )}
          </>
        ) : null}

        {state.status === "loading" ? <LoadingState strings={strings} /> : null}
        {state.status === "error" ? (
          <ErrorState
            strings={strings}
            unreachable={state.unreachable}
            onRetry={retry}
          />
        ) : null}

        <Link href="/design-system" asChild>
          <Button tone="quiet">
            <Text>Design system</Text>
          </Button>
        </Link>
      </ScrollView>
    </>
  );
}
