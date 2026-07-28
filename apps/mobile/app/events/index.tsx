import type {
  MemberAgendaPayload,
  PublicEventListPayload,
} from "@infokit/shared/public-content";
import { MemberSignedOutError } from "@infokit/api-client";
import { Callout, Text, useInfoKitTheme } from "@infokit/ui";
import Feather from "@expo/vector-icons/Feather";
import { Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { EventCard } from "~/components/content-cards";
import { ForwardChevron } from "~/components/forward-chevron";
import {
  PageHeading,
  PayloadScreen,
  SectionHeading,
} from "~/components/payload-screen";
import { memberClient, publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { useSession } from "~/lib/session";
import { usePublicPayload } from "~/lib/use-public-payload";

type Which = "public" | "member";

/**
 * The agenda: what is open to everyone, and — for a member — what their
 * organisations are coordinating.
 *
 * The two are one screen with a switch rather than two, because they answer the
 * same question and most readers only ever have one of them. The switch appears
 * only once someone is signed in; before that the door is a single quiet row at
 * the foot of the screen, never a banner over public content.
 *
 * Reached from home rather than from the tab bar: the bar is what a visitor who
 * has signed in to nothing uses, and this is the one screen that changes shape
 * for a member.
 */
export default function EventsScreen() {
  const { locale, strings } = usePreferences();
  const { state: session, refresh: refreshSession } = useSession();
  const signedIn = session.status === "signedIn";
  const [which, setWhich] = useState<Which>("public");
  const showing: Which = signedIn ? which : "public";

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (showing === "member") {
        try {
          return await memberClient.agenda({ locale, signal });
        } catch (cause) {
          // A session can be revoked between screens. That is not an error to
          // report: the public agenda is the honest answer, and asking the
          // session again puts the door back where it belongs.
          if (!(cause instanceof MemberSignedOutError)) throw cause;
          refreshSession();
        }
      }
      return await publicClient.listEvents({ locale, signal });
    },
    [locale, showing, refreshSession],
  );
  const request = usePublicPayload<
    PublicEventListPayload | MemberAgendaPayload
  >(load);
  // The stack header carries the name of what was opened; the payload's own
  // title says it again at the top of the screen for a reader who scrolled in.
  const state = request.state;
  const headerTitle =
    state.status === "ready"
      ? "page" in state.payload
        ? state.payload.page.title
        : state.payload.member.agendaTitle
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: headerTitle ?? "InfoKit" }} />
      <PayloadScreen request={request} strings={strings}>
        {(payload) => (
          <>
            {"page" in payload ? (
              <PageHeading
                eyebrow={payload.page.eyebrow}
                title={payload.page.title}
                description={payload.page.description}
                family="event"
              />
            ) : (
              <PageHeading
                eyebrow={payload.member.organizations}
                title={payload.member.agendaTitle}
                description={payload.member.agendaDescription}
                family="event"
              />
            )}

            {signedIn ? (
              <View className="border-line bg-surface rounded-control flex-row border p-1">
                <Segment
                  label={strings.eventsPublic}
                  selected={showing === "public"}
                  onPress={() => {
                    setWhich("public");
                  }}
                />
                <Segment
                  label={strings.eventsMembers}
                  selected={showing === "member"}
                  onPress={() => {
                    setWhich("member");
                  }}
                />
              </View>
            ) : null}

            {"page" in payload ? (
              <PublicAgenda payload={payload} />
            ) : (
              <MemberAgenda payload={payload} />
            )}

            {signedIn ? null : <MembersRow />}
          </>
        )}
      </PayloadScreen>
    </>
  );
}

function PublicAgenda({ payload }: { payload: PublicEventListPayload }) {
  return (
    <>
      <SectionHeading title={payload.labels.upcoming} family="event" />
      {payload.upcoming.length === 0 ? (
        <Text variant="muted">{payload.labels.empty}</Text>
      ) : (
        payload.upcoming.map((event) => (
          <EventCard key={event.id} event={event} labels={payload.labels} />
        ))
      )}

      {payload.past.length > 0 ? (
        <>
          <SectionHeading title={payload.labels.past} family="event" />
          {payload.past.map((event) => (
            <EventCard key={event.id} event={event} labels={payload.labels} />
          ))}
        </>
      ) : null}
    </>
  );
}

function MemberAgenda({ payload }: { payload: MemberAgendaPayload }) {
  return (
    <>
      {/* Who may read each row is said on the card; this says it once for all
          of them, because a member is about to read things a visitor cannot. */}
      <Callout tone="info" title={payload.member.whoSees}>
        {payload.member.reachOrganizationHint}
      </Callout>
      {payload.events.length === 0 ? (
        <Text variant="muted">{payload.member.empty}</Text>
      ) : (
        payload.events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            labels={payload.labels}
            member
          />
        ))
      )}
    </>
  );
}

function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={
        selected
          ? "min-h-touch rounded-control bg-brand-soft flex-1 items-center justify-center"
          : "min-h-touch rounded-control active:bg-subtle flex-1 items-center justify-center"
      }
    >
      <Text
        className={
          selected ? "text-brand-soft-ink font-semibold" : "text-copy-muted"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The members' door: one row, at the foot, after the public agenda has been
 * read. Its words come from the server with the "nobody is signed in" answer, so
 * a signed-out app carries no member strings of its own.
 */
function MembersRow() {
  const router = useRouter();
  const { state } = useSession();
  const { tokens } = useInfoKitTheme();
  const door = state.status === "signedOut" ? state.door : null;
  if (!door) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={door.doorTitle}
      onPress={() => {
        router.push("/sign-in");
      }}
      className="border-line bg-surface rounded-card active:bg-subtle min-h-[56px] flex-row items-center gap-3 border px-4 py-3"
    >
      <Feather name="users" size={18} color={tokens.textMuted} />
      <View className="flex-1">
        <Text className="font-semibold">{door.doorTitle}</Text>
        <Text variant="muted">{door.doorBody}</Text>
      </View>
      <ForwardChevron size={18} />
    </Pressable>
  );
}
