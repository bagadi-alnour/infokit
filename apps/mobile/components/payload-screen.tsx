import { Callout, directionProps, Text } from "@infokit/ui";
import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { ErrorState, LoadingState } from "~/components/request-states";
import type { AppStrings } from "~/lib/app-strings";
import type { PayloadRequest } from "~/lib/use-public-payload";

/**
 * The frame every reading screen shares: one scroller, pull-to-refresh, and the
 * three answers a request can end in.
 *
 * The direction comes from the payload rather than the app's own language,
 * because content can arrive in its source language when a translation is
 * missing — the text has to be laid out the way it reads, not the way the
 * interface does (docs/DESIGN-SYSTEM.md §3).
 */
export function PayloadScreen<Payload extends { direction: "ltr" | "rtl" }>({
  request,
  strings,
  children,
}: {
  request: PayloadRequest<Payload | null>;
  strings: AppStrings;
  children: (payload: Payload) => ReactNode;
}) {
  const { state, refreshing, refresh, retry } = request;
  const payload = state.status === "ready" ? state.payload : null;

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerClassName="gap-5 p-4 pb-16"
      {...(payload ? directionProps(payload.direction) : null)}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      {payload ? children(payload) : null}

      {state.status === "loading" ? <LoadingState strings={strings} /> : null}
      {/* Published content can be withdrawn while someone is reading it. */}
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
  );
}

/**
 * The four kinds of content the app carries (docs/DESIGN-SYSTEM.md §5).
 * Activities are the subject of the app and keep the accent; the agenda is
 * indigo, articles plum, guides copper.
 */
export type ContentFamily = "activity" | "event" | "article" | "guide";

const familyEyebrow: Record<ContentFamily, string> = {
  activity: "text-brand-deep",
  event: "text-event",
  article: "text-article",
  guide: "text-guide",
};

const familyRule: Record<ContentFamily, string> = {
  activity: "bg-brand",
  event: "bg-event",
  article: "bg-article",
  guide: "bg-guide",
};

/**
 * Eyebrow → title → description, the opening of every list screen.
 *
 * `family` tints the eyebrow and the short rule under it in the hue of the cards
 * below, so a screen is recognisable before a word of it is read — and a reader
 * who arrived from a card meets the colour that card wore. One element, and the
 * word is always beside it (rule 1).
 */
export function PageHeading({
  eyebrow,
  title,
  description,
  family = "activity",
}: {
  eyebrow: string;
  title: string;
  description: string;
  family?: ContentFamily;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <View className={`h-0.5 w-6 rounded-full ${familyRule[family]}`} />
        <Text variant="eyebrow" className={familyEyebrow[family]}>
          {eyebrow}
        </Text>
      </View>
      <Text variant="title">{title}</Text>
      <Text className="text-copy-muted">{description}</Text>
    </View>
  );
}

/**
 * A home band: one word for the band, and the way to the full list. The rule
 * before the word is in the hue of the cards under it, so the three bands of the
 * first screen are told apart by shape and colour at once.
 */
export function SectionHeading({
  title,
  action,
  family = "activity",
}: {
  title: string;
  action?: ReactNode;
  family?: ContentFamily;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1 flex-row items-center gap-2">
        <View className={`h-4 w-1 rounded-full ${familyRule[family]}`} />
        <Text variant="heading">{title}</Text>
      </View>
      {action}
    </View>
  );
}
