import type { PublicOrganizationDetailPayload } from "@infokit/shared/public-content";
import { Button, Callout, Card, CardTitle, MetaRow, Text } from "@infokit/ui";
import * as WebBrowser from "expo-web-browser";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";

import { ActivityCard } from "~/components/content-cards";
import { PayloadScreen, SectionHeading } from "~/components/payload-screen";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

/**
 * One association: who they are, and everything of theirs that is published.
 *
 * A name on a card is a question — "who is this?" — and until now the app
 * answered it by handing the reader to a browser. It answers it here instead: the
 * profile the association wrote, then their activities as the same cards the
 * reader was already looking at, so the way back is one press.
 *
 * Nothing on this screen is formatted by the app: the profile text, the year in
 * the reader's digits and the language notice all arrive worded by the server
 * (docs/UI-ARCHITECTURE.md §1).
 */
function OrganizationDetail({
  payload,
}: {
  payload: PublicOrganizationDetailPayload;
}) {
  const { organization, activities, labels, activityLabels } = payload;

  return (
    <>
      <View className="gap-2">
        <Text variant="eyebrow">{labels.eyebrow}</Text>
        <Text variant="title">{organization.name}</Text>
      </View>

      {organization.fallbackUsed ? (
        <Callout tone="info">{organization.fallbackLabel}</Callout>
      ) : null}

      <Card>
        <CardTitle>{labels.purpose}</CardTitle>
        <Text>{organization.purpose}</Text>
        {organization.foundedLabel ? (
          <MetaRow label={labels.founded}>{organization.foundedLabel}</MetaRow>
        ) : null}
      </Card>

      {organization.goals ? (
        <Card>
          <CardTitle>{labels.goals}</CardTitle>
          <Text>{organization.goals}</Text>
        </Card>
      ) : null}

      {organization.values ? (
        <Card>
          <CardTitle>{labels.values}</CardTitle>
          <Text>{organization.values}</Text>
        </Card>
      ) : null}

      {/* Their own site is the one link on this screen that genuinely leaves the
          app, so it says so and opens in the phone's in-app browser. */}
      {organization.website ? (
        <Card>
          <CardTitle>{labels.website}</CardTitle>
          <Button
            tone="outline"
            onPress={() => {
              void WebBrowser.openBrowserAsync(organization.website ?? "");
            }}
          >
            <Text>{organization.website}</Text>
          </Button>
        </Card>
      ) : null}

      <SectionHeading title={labels.activities} />
      {activities.length > 0 ? (
        <View className="gap-4">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              labels={activityLabels}
            />
          ))}
        </View>
      ) : (
        <Text variant="muted">{labels.activitiesEmpty}</Text>
      )}
    </>
  );
}

export default function OrganizationScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { locale, strings } = usePreferences();
  const load = useCallback(
    (signal: AbortSignal) =>
      publicClient.getOrganization(slug, { locale, signal }),
    [slug, locale],
  );
  const request = usePublicPayload(load);
  const name =
    request.state.status === "ready"
      ? request.state.payload?.organization.name
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: name ?? "InfoKit" }} />
      <PayloadScreen request={request} strings={strings}>
        {(payload) => <OrganizationDetail payload={payload} />}
      </PayloadScreen>
    </>
  );
}
