import type {
  PublicActivityListPayload,
  PublicArticleListPayload,
  PublicEventListPayload,
  PublicGuideListPayload,
} from "@infokit/shared/public-content";
import {
  Button,
  Callout,
  Card,
  CardDescription,
  CardTitle,
  Text,
  useInfoKitTheme,
} from "@infokit/ui";
import Feather from "@expo/vector-icons/Feather";
import { Link } from "expo-router";
import { useCallback } from "react";
import { Pressable, View } from "react-native";

import {
  ActivityCard,
  ArticleCard,
  EventCard,
} from "~/components/content-cards";
import { PayloadScreen, SectionHeading } from "~/components/payload-screen";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

/** What the first screen shows, in one answer: the four reads it draws from. */
interface HomePayload {
  direction: "ltr" | "rtl";
  activities: PublicActivityListPayload;
  events: PublicEventListPayload;
  articles: PublicArticleListPayload;
  guides: PublicGuideListPayload;
}

/** Enough to see there is something, not enough to scroll past the next band. */
const bandSize = 3;

/**
 * Home — what is open at this hour, what is next, what to read.
 *
 * The four lists load together and fail together on purpose: a first screen that
 * shows one band and four spinners tells a reader nothing about whether the app
 * is working. Every band is a shortcut into a fuller screen, never a replacement
 * for it, so nothing here is the only way to reach anything — and the agenda,
 * which has no tab of its own, is reached from the band that names it.
 */
export default function HomeScreen() {
  const { locale, strings } = usePreferences();
  const { tokens } = useInfoKitTheme();

  const load = useCallback(
    async (signal: AbortSignal): Promise<HomePayload> => {
      const [activities, events, articles, guides] = await Promise.all([
        publicClient.listActivities({ locale, signal }),
        publicClient.listEvents({ locale, signal }),
        publicClient.listArticles({ locale, signal }),
        publicClient.listGuides({ locale, signal }),
      ]);
      return {
        direction: activities.direction,
        activities,
        events,
        articles,
        guides,
      };
    },
    [locale],
  );
  const request = usePublicPayload(load);

  return (
    <PayloadScreen request={request} strings={strings}>
      {({ activities, events, articles, guides }) => {
        const openNow = activities.activities.filter(
          (activity) => activity.status === "open",
        );
        const nextEvents = events.upcoming.slice(0, bandSize);
        const latest = articles.articles[0];

        return (
          <>
            <Callout tone="info">{activities.page.freshnessNotice}</Callout>

            {/* The guide is offered above the bands as well as in the bar: it is
                a task someone starts once, and the moment to start it is the
                first screen, not a tab they have to think of. */}
            {guides.guides.length > 0 ? (
              <Link href="/guides" asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={guides.page.title}
                >
                  <Card className="border-guide bg-guide-wash">
                    <View className="flex-row items-center gap-2">
                      <Feather
                        name="compass"
                        size={18}
                        color={tokens.guideAccent}
                      />
                      <Text variant="eyebrow" className="text-guide">
                        {guides.page.eyebrow}
                      </Text>
                    </View>
                    <CardTitle>{guides.page.title}</CardTitle>
                    <CardDescription>{guides.page.description}</CardDescription>
                    <Text variant="muted">{guides.labels.privacy}</Text>
                  </Card>
                </Pressable>
              </Link>
            ) : null}

            <View className="gap-3">
              <SectionHeading
                title={strings.openNow}
                family="activity"
                action={
                  <Link href="/now" asChild>
                    <Button tone="quiet" block={false}>
                      <Text>{strings.seeAll}</Text>
                    </Button>
                  </Link>
                }
              />
              {openNow.length === 0 ? (
                <Text variant="muted">{strings.openNowEmpty}</Text>
              ) : (
                openNow
                  .slice(0, bandSize)
                  .map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      labels={activities.labels}
                      compact
                    />
                  ))
              )}
            </View>

            <View className="gap-3">
              <SectionHeading
                title={strings.nextUp}
                family="event"
                action={
                  <Link href="/events" asChild>
                    <Button tone="quiet" block={false}>
                      <Text>{strings.seeAll}</Text>
                    </Button>
                  </Link>
                }
              />
              {nextEvents.length === 0 ? (
                <Text variant="muted">{events.labels.empty}</Text>
              ) : (
                nextEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    labels={events.labels}
                  />
                ))
              )}
            </View>

            <View className="gap-3">
              <SectionHeading
                title={strings.latest}
                family="article"
                action={
                  <Link href="/articles" asChild>
                    <Button tone="quiet" block={false}>
                      <Text>{strings.seeAll}</Text>
                    </Button>
                  </Link>
                }
              />
              {latest ? (
                <ArticleCard article={latest} labels={articles.labels} />
              ) : (
                <Text variant="muted">{articles.labels.empty}</Text>
              )}
            </View>
          </>
        );
      }}
    </PayloadScreen>
  );
}
