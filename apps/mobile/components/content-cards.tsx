import type { ReactNode } from "react";

import type {
  PublicActivityLabels,
  PublicActivityService,
  PublicActivityStatus,
  PublicActivitySummary,
  PublicArticleLabels,
  PublicArticleSummary,
  PublicEventLabels,
  PublicEventSummary,
  PublicSimulatorCollectionLabels,
  PublicSimulatorSummary,
} from "@infokit/shared/public-content";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Chip,
  cn,
  MetaRow,
  StatusPill,
  Text,
  useInfoKitTheme,
} from "@infokit/ui";
import Feather from "@expo/vector-icons/Feather";
import { Link } from "expo-router";
import { View } from "react-native";

import {
  AddressLink,
  CoverImage,
  OrganisationLink,
} from "~/components/content-parts";
import { TaxonomyIcon } from "~/components/taxonomy-icon";
import { hrefSlug } from "~/lib/href-slug";
import { hasMapTarget, type MapTarget } from "~/lib/open-map";

/**
 * Each kind of card is built differently, so a reader knows what they are
 * holding before they read it (docs/DESIGN-SYSTEM.md §5, content families):
 *
 * - an **activity** wears its status as a rule across the top of the card;
 * - an **event** puts its date in a washed indigo block;
 * - an **article** is typographic — a plum rule under the title, nothing filled;
 * - a **guide** is the one washed card, because it is an invitation, not a fact.
 *
 * The family hue is structure, never a signal: the status ramp keeps its own
 * four colours, and no card asks a reader to read a colour (rule 1).
 */

/** The status ramp, as the rule across the head of an activity card. */
const statusRule: Record<PublicActivityStatus, string> = {
  open: "bg-ok",
  closed: "bg-neutral",
  cancelled: "bg-danger",
  uncertain: "bg-warn",
};

/** The word for a status, from the labels the payload carries. */
export function statusLabel(
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
 * The address of an activity, in the form the phone's map application wants, or
 * null when the editor gave no location precise enough to send anyone to.
 */
export function activityMapTarget(
  activity: PublicActivitySummary,
): MapTarget | null {
  const target: MapTarget = {
    label: activity.address.trim() || activity.placeName.trim(),
    latitude: activity.latitude,
    longitude: activity.longitude,
    fallbackHref: activity.mapHref,
  };
  return hasMapTarget(target) ? target : null;
}

/**
 * What is handed out here, each service with the glyph of its own catalogue row.
 * The word is what identifies it; the picture is what makes a list of them
 * scannable to someone reading a language they are still learning.
 */
export function ServiceChips({
  services,
}: {
  services: PublicActivityService[];
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {services.map((service) => (
        <Chip
          key={service.id}
          label={service.label}
          icon={<TaxonomyIcon name={service.icon} />}
        />
      ))}
    </View>
  );
}

/**
 * The associations running an activity, each a link to its public page. Older
 * payloads carry only the names, so those are still printed as a plain row.
 */
export function ProviderLinks({
  activity,
  label,
}: {
  activity: PublicActivitySummary;
  label: string;
}) {
  if (activity.providers.length > 0) {
    return (
      <View>
        {activity.providers.map((provider, index) => (
          <OrganisationLink
            key={provider.href}
            name={provider.name}
            href={provider.href}
            label={index === 0 ? label : undefined}
          />
        ))}
      </View>
    );
  }
  if (activity.providerNames.length > 0) {
    return (
      <MetaRow label={label}>{activity.providerNames.join(" · ")}</MetaRow>
    );
  }
  return null;
}

/**
 * One published activity, in the fixed reading order of docs/DESIGN-SYSTEM.md
 * §1: state → what it is → where → for whom → how fresh. Every string arrives
 * localized from the server, so this card formats nothing.
 *
 * `compact` drops the rows that only matter when comparing a long list, for the
 * "open now" band on the first screen.
 *
 * The rule across the head repeats the status a third time, after the word and
 * the glyph in the pill: down a long list it is what lets someone find the open
 * places by thumb, without reading every card.
 */
export function ActivityCard({
  activity,
  labels,
  compact = false,
}: {
  activity: PublicActivitySummary;
  labels: PublicActivityLabels;
  compact?: boolean;
}) {
  const target = activityMapTarget(activity);

  return (
    <ActivityCardFrame status={activity.status}>
      <CoverImage image={activity.coverImage} />
      <View className="flex-row flex-wrap items-center gap-2">
        <StatusPill
          role={activity.status}
          label={statusLabel(activity.status, labels)}
          detail={activity.nextOpeningLabel ?? undefined}
        />
        <Chip
          label={activity.categoryLabel}
          icon={<TaxonomyIcon name={activity.categoryIcon} />}
        />
      </View>
      <CardTitle>{activity.name}</CardTitle>
      <CardDescription>{activity.shortDescription}</CardDescription>
      {/* The place is the next step, not a caption: pressing it opens the map
          application with the address already in it. */}
      {target ? (
        <AddressLink
          label={labels.place}
          placeName={activity.placeName}
          address={compact ? undefined : activity.address}
          target={target}
          actionLabel={labels.mapView}
        />
      ) : (
        <MetaRow label={labels.place}>{activity.placeName}</MetaRow>
      )}
      {activity.services.length > 0 ? (
        <ServiceChips services={activity.services} />
      ) : null}
      {compact ? null : (
        <>
          {labels.audience ? (
            <MetaRow label={labels.audience}>{activity.audienceLabel}</MetaRow>
          ) : null}
          <MetaRow label={labels.schedule}>
            {activity.scheduleLabels.join(" · ")}
          </MetaRow>
          <ProviderLinks activity={activity} label={labels.provider} />
          {activity.fallbackUsed ? (
            <Text variant="muted">{activity.fallbackLabel}</Text>
          ) : null}
        </>
      )}
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
    </ActivityCardFrame>
  );
}

/**
 * The shape of every activity card, wherever one appears: a status rule, then
 * the card. Shared so the map sheet reads as the same object as the list.
 */
export function ActivityCardFrame({
  status,
  className,
  children,
}: {
  status: PublicActivityStatus;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      <View className={cn("h-1.5", statusRule[status])} />
      <View className="gap-3 p-4">{children}</View>
    </Card>
  );
}

/**
 * One dated event. Cancelled is said in words on the card itself, because a
 * reader may plan a whole morning around a line they only half read.
 *
 * `member` marks a card that came from the shared agenda: the detail screen then
 * reads it back through the members' endpoint, which is the only one that may
 * answer for an event not open to everyone.
 */
export function EventCard({
  event,
  labels,
  member = false,
}: {
  event: PublicEventSummary;
  labels: PublicEventLabels;
  member?: boolean;
}) {
  return (
    <Card>
      <CoverImage image={event.coverImage} />
      <View className="flex-row flex-wrap items-center gap-2">
        {event.cancelled ? (
          <StatusPill role="cancelled" label={labels.cancelled} />
        ) : null}
        <Chip label={event.reachLabel} />
      </View>
      <CardTitle>{event.title}</CardTitle>
      {/* An event is a date first: it gets the one block on the card, in the
          family hue of the agenda, so a reader can find the day at a glance. */}
      <View className="rounded-control bg-event-wash gap-0.5 p-3">
        <Text variant="eyebrow" className="text-event">
          {labels.when}
        </Text>
        <Text className="text-event font-semibold">
          {event.allDay
            ? `${event.dateLabel} · ${labels.allDay}`
            : `${event.dateLabel} · ${event.timeLabel}`}
        </Text>
      </View>
      {event.whereLabel ? (
        <AddressLink
          label={labels.where}
          placeName={event.whereLabel}
          target={{
            label: event.whereLabel,
            latitude: null,
            longitude: null,
            fallbackHref: event.mapHref,
          }}
          actionLabel={labels.openMap}
        />
      ) : null}
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
      {event.cancelled && event.cancellationReason ? (
        <Text variant="muted">{event.cancellationReason}</Text>
      ) : null}
      <Link
        href={{
          pathname: "/events/[id]",
          params: member ? { id: event.id, member: "1" } : { id: event.id },
        }}
        asChild
      >
        <Button tone="outline">
          <Text className="text-event">{labels.details}</Text>
        </Button>
      </Link>
    </Card>
  );
}

/**
 * One article. The review date sits on the card: age is part of the content.
 *
 * Nothing is filled here — an article is a piece of reading, so the card is
 * typographic: the title, a short plum rule of the reading family under it, then
 * prose.
 */
export function ArticleCard({
  article,
  labels,
}: {
  article: PublicArticleSummary;
  labels: PublicArticleLabels;
}) {
  return (
    <Card>
      <CoverImage image={article.coverImage} />
      {article.unreliable ? (
        <StatusPill role="uncertain" label={labels.unreliable} />
      ) : null}
      <CardTitle>{article.title}</CardTitle>
      <View className="bg-article h-0.5 w-10 self-start rounded-full" />
      <CardDescription>{article.summary}</CardDescription>
      {article.ownerNames.length > 0 ? (
        <MetaRow label={labels.publishedBy}>
          {article.ownerNames.join(" · ")}
        </MetaRow>
      ) : null}
      <Text variant="muted">
        {labels.lastReviewed} · {article.lastReviewedLabel}
      </Text>
      {article.fallbackUsed ? (
        <Text variant="muted">{article.fallbackLabel}</Text>
      ) : null}
      <Link
        href={{
          pathname: "/articles/[slug]",
          params: { slug: hrefSlug(article.href) },
        }}
        asChild
      >
        <Button tone="outline">
          <Text className="text-article">{labels.read}</Text>
        </Button>
      </Link>
    </Card>
  );
}

/**
 * One guided walk-through — the only washed card in the app. A guide is an
 * invitation to spend a few minutes answering questions, not a fact to check in
 * passing, so it is the one card that does not look like the surface it sits on.
 */
export function GuideCard({
  guide,
  labels,
}: {
  guide: PublicSimulatorSummary;
  labels: PublicSimulatorCollectionLabels;
}) {
  const { tokens } = useInfoKitTheme();

  return (
    <Card className="border-guide bg-guide-wash">
      <View className="flex-row items-center gap-2">
        <Feather name="compass" size={16} color={tokens.guideAccent} />
        <Text variant="eyebrow" className="text-guide">
          {labels.city}
        </Text>
        <Text className="text-guide text-sm font-semibold">
          {guide.cityLabel}
        </Text>
      </View>
      <CardTitle>{guide.title}</CardTitle>
      <CardDescription>{guide.summary}</CardDescription>
      <Text variant="muted">
        {labels.lastReviewed} · {guide.lastReviewedLabel}
      </Text>
      <Link
        href={{
          pathname: "/guides/[slug]",
          params: { slug: hrefSlug(guide.href) },
        }}
        asChild
      >
        <Button tone="outline">
          <Text className="text-guide">{labels.open}</Text>
        </Button>
      </Link>
    </Card>
  );
}
