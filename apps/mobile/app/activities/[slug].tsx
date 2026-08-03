import type { PublicActivityDetailPayload } from "@infokit/shared/public-content";
import { brandName } from "@infokit/shared/i18n";
import {
  Callout,
  Card,
  CardTitle,
  Chip,
  MetaRow,
  StatusPill,
  Text,
} from "@infokit/ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";

import {
  activityMapTarget,
  ProviderLinks,
  ServiceChips,
} from "~/components/content-cards";
import {
  AddressLink,
  CoverImage,
  TransitLinks,
} from "~/components/content-parts";
import { PayloadScreen } from "~/components/payload-screen";
import { TaxonomyIcon } from "~/components/taxonomy-icon";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

function ActivityDetail({ payload }: { payload: PublicActivityDetailPayload }) {
  const { activity, labels } = payload;
  const statusWords = {
    open: labels.statusOpen,
    closed: labels.statusClosed,
    cancelled: labels.statusCancelled,
    uncertain: labels.statusUncertain,
  };
  const target = activityMapTarget(activity);
  const hasProvider =
    activity.providers.length > 0 || activity.providerNames.length > 0;

  return (
    <>
      <CoverImage image={activity.coverImage} className="rounded-card h-44" />

      <View className="flex-row flex-wrap items-center gap-2">
        <StatusPill
          role={activity.status}
          label={statusWords[activity.status]}
          detail={activity.nextOpeningLabel ?? undefined}
        />
        <Chip
          label={activity.categoryLabel}
          icon={<TaxonomyIcon name={activity.categoryIcon} />}
        />
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
        {target ? (
          // Pressing the address hands it to the phone's map application; the
          // app never asks the phone where its owner is.
          <AddressLink
            placeName={activity.placeName}
            address={activity.address || undefined}
            target={target}
            actionLabel={labels.mapView}
          />
        ) : (
          <>
            <Text>{activity.placeName}</Text>
            <Text variant="muted">{labels.noMap}</Text>
          </>
        )}
      </Card>

      {/* Inside the place card would hide it behind a pressable address; its own
          card because a bus line is publishable when an address is not, and that
          reader is the one who needs it most. */}
      {activity.transit.length > 0 ? (
        <Card>
          <CardTitle>{labels.gettingHere}</CardTitle>
          <TransitLinks links={activity.transit} />
        </Card>
      ) : null}

      {labels.audience || activity.services.length > 0 || hasProvider ? (
        <Card>
          {labels.audience ? (
            <MetaRow label={labels.audience}>{activity.audienceLabel}</MetaRow>
          ) : null}
          {activity.services.length > 0 ? (
            <>
              <Text variant="eyebrow">{labels.services}</Text>
              <ServiceChips services={activity.services} />
            </>
          ) : null}
          <ProviderLinks activity={activity} label={labels.provider} />
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
  const { locale, strings } = usePreferences();
  const load = useCallback(
    (signal: AbortSignal) => publicClient.getActivity(slug, { locale, signal }),
    [slug, locale],
  );
  const request = usePublicPayload(load);
  const name =
    request.state.status === "ready"
      ? request.state.payload?.activity.name
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: name ?? brandName(locale) }} />
      <PayloadScreen request={request} strings={strings}>
        {(payload) => <ActivityDetail payload={payload} />}
      </PayloadScreen>
    </>
  );
}
