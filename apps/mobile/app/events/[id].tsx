import type {
  MemberEventPayload,
  PublicEventDetailPayload,
} from "@infokit/shared/public-content";
import { brandName } from "@infokit/shared/i18n";
import {
  Button,
  Callout,
  Card,
  CardTitle,
  Chip,
  MetaRow,
  StatusPill,
  Text,
} from "@infokit/ui";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";

import {
  AddressLink,
  CoverImage,
  OrganisationLink,
  TransitLinks,
} from "~/components/content-parts";
import { PayloadScreen } from "~/components/payload-screen";
import { memberClient, publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

/**
 * One event.
 *
 * The `member` parameter says which door the reader came through, and the screen
 * reads the event back through that same door: the public endpoint only ever
 * answers for events open to everyone, and the members' one is the only place a
 * coordination meeting exists. An event that has since been narrowed comes back
 * as "no longer published" rather than as a refusal — the app never confirms
 * that something it may not show exists.
 */
export default function EventScreen() {
  const { id, member } = useLocalSearchParams<{
    id: string;
    member?: string;
  }>();
  const { locale, strings } = usePreferences();
  const fromMemberAgenda = member === "1";

  const load = useCallback(
    (
      signal: AbortSignal,
    ): Promise<PublicEventDetailPayload | MemberEventPayload | null> =>
      fromMemberAgenda
        ? memberClient.event(id, { locale, signal })
        : publicClient.getEvent(id, { locale, signal }),
    [id, locale, fromMemberAgenda],
  );
  const request = usePublicPayload(load);
  const title =
    request.state.status === "ready"
      ? request.state.payload?.event.title
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: title ?? brandName(locale) }} />
      <PayloadScreen request={request} strings={strings}>
        {({ event, labels }) => {
          // Read once: a closure cannot rely on narrowing a property access.
          const mapHref = event.mapHref;
          const icsHref = publicClient.resolveUrl(event.icsHref);

          return (
            <>
              <CoverImage
                image={event.coverImage}
                className="rounded-card h-44"
              />

              <View className="flex-row flex-wrap items-center gap-2">
                {event.cancelled ? (
                  <StatusPill role="cancelled" label={labels.cancelled} />
                ) : null}
                <Chip label={event.reachLabel} />
              </View>

              <Text variant="title">{event.title}</Text>

              {event.cancelled ? (
                <Callout tone="warning" title={labels.cancelled}>
                  {event.cancellationReason ?? labels.cancelledNoReason}
                </Callout>
              ) : null}

              {/* The date is the one washed card on the page, in the family hue
                  of the agenda — the same block the list card carries, opened
                  out (docs/DESIGN-SYSTEM.md §5). */}
              <Card className="border-event-wash bg-event-wash">
                <CardTitle className="text-event">{labels.when}</CardTitle>
                <Text className="text-event font-semibold">
                  {event.dateLabel}
                </Text>
                <Text className="text-event font-semibold">
                  {event.allDay ? labels.allDay : event.timeLabel}
                </Text>
                {/* The calendar file is fetched by the phone's calendar app,
                    which carries no device session — so it is offered only for
                    the events anyone may fetch. */}
                {event.reach === "public" ? (
                  <Button
                    tone="outline"
                    onPress={() => {
                      void Linking.openURL(icsHref);
                    }}
                  >
                    <Text>{labels.addToCalendar}</Text>
                  </Button>
                ) : null}
              </Card>

              <Card>
                <CardTitle>{labels.where}</CardTitle>
                {/* An event people join from anywhere answers "where" with a
                    link, or with the promise of one — never with an address it
                    does not have. */}
                {event.isOnline ? (
                  <MetaRow label={labels.onlineJoin}>
                    {event.onlineUrl === null ? (
                      <Text>{labels.onlineNoLink}</Text>
                    ) : (
                      <Text
                        className="text-brand underline"
                        onPress={() => {
                          void Linking.openURL(event.onlineUrl ?? "");
                        }}
                      >
                        {labels.online}
                      </Text>
                    )}
                  </MetaRow>
                ) : null}
                {event.whereLabel ? (
                  // Pressing the address opens the phone's map application with
                  // it; nothing about the reader's own position leaves the phone.
                  <AddressLink
                    placeName={event.whereLabel}
                    target={{
                      label: event.whereLabel,
                      latitude: null,
                      longitude: null,
                      fallbackHref: mapHref,
                    }}
                    actionLabel={labels.openMap}
                  />
                ) : event.isOnline ? null : (
                  <Text>{labels.notAvailable}</Text>
                )}
                {event.cityName || !event.isOnline ? (
                  <MetaRow label={labels.city}>{event.cityName}</MetaRow>
                ) : null}
                {/* In the place card rather than beside it: the question a
                    reader asks straight after reading an address they do not
                    recognise, and only the organisers can answer it. */}
                {event.transit.length > 0 ? (
                  <>
                    <Text variant="eyebrow">{labels.gettingHere}</Text>
                    <TransitLinks links={event.transit} />
                  </>
                ) : null}
              </Card>

              {event.description ? (
                <Card>
                  <Text>{event.description}</Text>
                </Card>
              ) : null}

              <Card>
                {event.hostName ? (
                  event.hostHref ? (
                    <OrganisationLink
                      name={event.hostName}
                      href={event.hostHref}
                      label={labels.host}
                    />
                  ) : (
                    <MetaRow label={labels.host}>{event.hostName}</MetaRow>
                  )
                ) : null}
                {event.contactLabel && event.contactValue ? (
                  <MetaRow label={event.contactLabel}>
                    {event.contactValue}
                  </MetaRow>
                ) : null}
                <Text variant="muted">{labels.checkBefore}</Text>
              </Card>
            </>
          );
        }}
      </PayloadScreen>
    </>
  );
}
