"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Anchor,
  Button,
  Card,
  H1,
  H2,
  Image,
  Input,
  Paragraph,
  Separator,
  Text,
  XStack,
  YStack,
  styled,
} from "tamagui";

export interface PublicContentImage {
  url: string;
  alt: string;
  decorative: boolean;
}

export interface PublicActivitySummary {
  id: string;
  slug: string;
  href: string;
  name: string;
  shortDescription: string;
  categoryCode: string;
  categoryLabel: string;
  categoryIcon: string;
  audienceCode: string;
  audienceLabel: string;
  services: { id: string; label: string; icon: string }[];
  providerNames: string[];
  /** Providers with a link to their public organisation page. */
  providers: { name: string; href: string }[];
  placeName: string;
  address: string;
  /** External map link for the address, or null when no exact location. */
  mapHref: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "open" | "closed" | "cancelled" | "uncertain";
  /** Localized "opens next …" line, shown when currently closed. */
  nextOpeningLabel: string | null;
  fallbackUsed: boolean;
  /** Localized fallback notice with the content language name filled in. */
  fallbackLabel: string;
  lastVerifiedLabel: string;
  scheduleLabels: string[];
  coverImage: PublicContentImage | null;
}

export interface PublicActivityLabels {
  search: string;
  categoryFilter: string;
  allCategories: string;
  audienceFilter: string;
  allAudiences: string;
  serviceFilter: string;
  allServices: string;
  statusFilter: string;
  allStatuses: string;
  listView: string;
  mapView: string;
  results: string;
  empty: string;
  provider: string;
  services: string;
  place: string;
  schedule: string;
  lastVerified: string;
  fallback: string;
  open: string;
  mapTitle: string;
  mapHint: string;
  noMap: string;
  statusOpen: string;
  statusClosed: string;
  statusCancelled: string;
  statusUncertain: string;
}

export interface PublicArticleSummary {
  id: string;
  href: string;
  title: string;
  summary: string;
  articleDateLabel: string;
  ownerNames: string[];
  lastReviewedLabel: string;
  fallbackUsed: boolean;
  unreliable: boolean;
  coverImage: PublicContentImage | null;
}

export interface PublicArticleLabels {
  empty: string;
  read: string;
  publishedBy: string;
  lastReviewed: string;
  fallback: string;
  unreliable: string;
}

export interface PublicSimulatorSummary {
  id: string;
  href: string;
  title: string;
  summary: string;
  cityLabel: string;
  lastReviewedLabel: string;
  sourceLanguageLabel: string;
}

export interface PublicSimulatorCollectionLabels {
  empty: string;
  open: string;
  city: string;
  lastReviewed: string;
  sourceLanguage: string;
  privacy: string;
}

export function PublicThemeToggleButton({
  label,
  dark,
  onPress,
}: {
  label: string;
  dark: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      minWidth={44}
      minHeight={44}
      circular
      backgroundColor="$surface"
      borderColor="$borderStrong"
      color="$color"
      aria-label={label}
      onPress={onPress}
    >
      <Text fontSize="$5" aria-hidden>
        {dark ? "☀" : "☾"}
      </Text>
    </Button>
  );
}

export function PublicHomeExperience({
  labels,
  links,
  counts,
}: {
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    primaryAction: string;
    activities: string;
    activitiesDescription: string;
    articles: string;
    articlesDescription: string;
    guide: string;
    guideDescription: string;
    reliability: string;
    reliabilityDescription: string;
    published: string;
  };
  links: { activities: string; articles: string; guide: string };
  counts: { activities: number; articles: number; guides: number };
}) {
  const sections = [
    {
      key: "activities",
      title: labels.activities,
      description: labels.activitiesDescription,
      href: links.activities,
      count: counts.activities,
    },
    {
      key: "articles",
      title: labels.articles,
      description: labels.articlesDescription,
      href: links.articles,
      count: counts.articles,
    },
    {
      key: "guide",
      title: labels.guide,
      description: labels.guideDescription,
      href: links.guide,
      count: counts.guides,
    },
  ];
  return (
    <YStack gap="$calais7">
      <YStack maxWidth={760} gap="$calais4">
        <Text
          color="$accent"
          fontSize="$2"
          fontWeight="800"
          textTransform="uppercase"
          letterSpacing={0.8}
        >
          {labels.eyebrow}
        </Text>
        <H1
          fontSize="$10"
          lineHeight="$10"
          fontWeight="700"
          $max-sm={{ fontSize: "$8", lineHeight: "$8" }}
        >
          {labels.title}
        </H1>
        <Paragraph
          maxWidth={700}
          color="$mutedText"
          fontSize="$5"
          lineHeight="$7"
        >
          {labels.description}
        </Paragraph>
        <CardLink
          href={links.activities}
          alignSelf="flex-start"
          paddingHorizontal="$calais6"
        >
          {labels.primaryAction}
        </CardLink>
      </YStack>

      <XStack flexWrap="wrap" gap="$calais4">
        {sections.map((section) => (
          <ContentCard key={section.key} flex={1} minWidth={240}>
            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <H2 fontSize="$6" fontWeight="700">
                {section.title}
              </H2>
              <Text
                minWidth={36}
                textAlign="center"
                backgroundColor="$accentSoft"
                color="$accent"
                borderRadius="$control"
                padding="$calais2"
                fontWeight="800"
              >
                {section.count}
              </Text>
            </XStack>
            <Paragraph
              color="$mutedText"
              fontSize="$3"
              lineHeight="$5"
              flex={1}
            >
              {section.description}
            </Paragraph>
            <CardLink href={section.href}>{labels.published}</CardLink>
          </ContentCard>
        ))}
      </XStack>

      <YStack
        gap="$calais2"
        padding="$calais5"
        backgroundColor="$successSoft"
        borderRadius="$card"
      >
        <Text color="$success" fontWeight="800">
          {labels.reliability}
        </Text>
        <Paragraph color="$color" fontSize="$3" lineHeight="$5">
          {labels.reliabilityDescription}
        </Paragraph>
      </YStack>
    </YStack>
  );
}

const ContentCard = styled(Card, {
  name: "PublicContentCard",
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$borderColor",
  borderRadius: "$card",
  padding: "$calais5",
  gap: "$calais3",
  shadowColor: "transparent",
});

const CardLink = styled(Anchor, {
  name: "PublicCardLink",
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "$accent",
  color: "$accentContrast",
  borderRadius: "$control",
  paddingHorizontal: "$calais4",
  fontWeight: "700",
  textDecorationLine: "none",
  hoverStyle: { backgroundColor: "$accentHover" },
  focusStyle: { outlineColor: "$accent", outlineWidth: 3 },
});

function CoverImage({
  image,
  compact,
}: {
  image: PublicContentImage;
  compact?: boolean;
}) {
  return (
    <Image
      src={image.url}
      alt={image.alt}
      accessibilityLabel={image.decorative ? undefined : image.alt}
      width={compact ? 160 : "100%"}
      aspectRatio={compact ? 1 : 16 / 9}
      flexShrink={0}
      objectFit="cover"
      borderRadius="$card"
      backgroundColor="$subtle"
    />
  );
}

function ActivityCard({
  activity,
  labels,
}: {
  activity: PublicActivitySummary;
  labels: PublicActivityLabels;
}) {
  const statusLabel =
    activity.status === "cancelled"
      ? labels.statusCancelled
      : activity.status === "uncertain"
        ? labels.statusUncertain
        : activity.status === "open"
          ? labels.statusOpen
          : labels.statusClosed;
  const statusBackground =
    activity.status === "cancelled"
      ? "$dangerSoft"
      : activity.status === "uncertain"
        ? "$warningSoft"
        : activity.status === "open"
          ? "$successSoft"
          : "$subtle";
  const statusColor =
    activity.status === "cancelled"
      ? "$danger"
      : activity.status === "uncertain"
        ? "$warning"
        : activity.status === "open"
          ? "$success"
          : "$mutedText";

  const closed = activity.status === "closed";
  return (
    <ContentCard>
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        {closed ? (
          <YStack />
        ) : (
          <Text color="$accent" fontSize="$2" fontWeight="800">
            {activity.categoryLabel}
          </Text>
        )}
        <Text
          backgroundColor={
            closed && activity.nextOpeningLabel
              ? "$dangerSoft"
              : statusBackground
          }
          color={closed && activity.nextOpeningLabel ? "$danger" : statusColor}
          borderRadius="$control"
          paddingHorizontal="$calais3"
          paddingVertical="$calais1"
          fontSize="$2"
          fontWeight="700"
        >
          {closed && activity.nextOpeningLabel
            ? activity.nextOpeningLabel
            : statusLabel}
        </Text>
      </XStack>
      <H2 fontSize="$6" lineHeight="$6" fontWeight="700">
        {activity.name}
      </H2>
      {activity.shortDescription ? (
        <Paragraph color="$mutedText" fontSize="$3" lineHeight="$5">
          {activity.shortDescription}
        </Paragraph>
      ) : null}
      {activity.fallbackUsed ? (
        <Text color="$accent" fontSize="$2" fontWeight="700">
          {activity.fallbackLabel}
        </Text>
      ) : null}
      <Separator borderColor="$borderColor" />
      <XStack gap="$calais4" alignItems="flex-start">
        {activity.coverImage ? (
          <CoverImage image={activity.coverImage} compact />
        ) : null}
        <YStack flex={1} minWidth={0} gap="$calais2">
          <Text fontSize="$3">
            <Text fontWeight="700">{labels.provider}: </Text>
            {activity.providers.length > 0
              ? activity.providers.map((provider, index) => (
                  <Text key={provider.href}>
                    {index > 0 ? ", " : null}
                    <Anchor href={provider.href} color="$accent">
                      {provider.name}
                    </Anchor>
                  </Text>
                ))
              : activity.providerNames.join(", ")}
          </Text>
          {activity.services.length > 0 ? (
            <Text fontSize="$3">
              <Text fontWeight="700">{labels.services}: </Text>
              {activity.services.map((service) => service.label).join(", ")}
            </Text>
          ) : null}
          <Text fontSize="$3">
            <Text fontWeight="700">{labels.place}: </Text>
            {activity.mapHref ? (
              <Anchor
                href={activity.mapHref}
                target="_blank"
                rel="noreferrer"
                color="$accent"
              >
                {activity.address || activity.placeName}
              </Anchor>
            ) : (
              activity.address || activity.placeName
            )}
          </Text>
          <Text fontSize="$3">
            <Text fontWeight="700">{labels.schedule}: </Text>
            {activity.scheduleLabels.join(" · ")}
          </Text>
          <Text color="$mutedText" fontSize="$2">
            {labels.lastVerified}: {activity.lastVerifiedLabel}
          </Text>
        </YStack>
      </XStack>
      <CardLink href={activity.href}>{labels.open}</CardLink>
    </ContentCard>
  );
}

export function PublicActivitiesExplorer({
  activities,
  labels,
  renderMap,
}: {
  activities: PublicActivitySummary[];
  labels: PublicActivityLabels;
  renderMap?: (activities: PublicActivitySummary[]) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState("");
  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          activities.map((activity) => [
            activity.categoryCode,
            activity.categoryLabel,
          ]),
        ),
      ),
    [activities],
  );
  const audiences = useMemo(
    () =>
      Array.from(
        new Map(
          activities.map((activity) => [
            activity.audienceCode,
            activity.audienceLabel,
          ]),
        ),
      ),
    [activities],
  );
  const services = useMemo(
    () =>
      Array.from(
        new Map(
          activities.flatMap((activity) =>
            activity.services.map((item) => [item.id, item.label] as const),
          ),
        ),
      ),
    [activities],
  );
  const statuses = [
    ["open", labels.statusOpen],
    ["closed", labels.statusClosed],
    ["cancelled", labels.statusCancelled],
    ["uncertain", labels.statusUncertain],
  ] as const;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return activities.filter((activity) => {
      const searchable = [
        activity.name,
        activity.shortDescription,
        activity.categoryLabel,
        activity.audienceLabel,
        activity.placeName,
        activity.address,
        ...activity.services.map((item) => item.label),
        ...activity.providerNames,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!category || activity.categoryCode === category) &&
        (!audience || activity.audienceCode === audience) &&
        (!service || activity.services.some((item) => item.id === service)) &&
        (!status || activity.status === status) &&
        (!normalized || searchable.includes(normalized))
      );
    });
  }, [activities, audience, category, query, service, status]);
  const mapped = filtered.flatMap((activity) =>
    activity.latitude === null || activity.longitude === null
      ? []
      : [
          {
            ...activity,
            latitude: activity.latitude,
            longitude: activity.longitude,
          },
        ],
  );
  const latitudes = mapped.map((activity) => activity.latitude);
  const longitudes = mapped.map((activity) => activity.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const selected =
    mapped.find((activity) => activity.id === selectedId) ?? mapped[0];

  return (
    <YStack gap="$calais5">
      <YStack gap="$calais3">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={labels.search}
          aria-label={labels.search}
          minHeight={48}
          backgroundColor="$surface"
          borderColor="$borderStrong"
          borderRadius="$control"
          fontSize="$4"
        />
        <YStack gap="$calais2">
          <Text color="$mutedText" fontSize="$2" fontWeight="700">
            {labels.categoryFilter}
          </Text>
          <XStack flexWrap="wrap" gap="$calais2">
            <Button
              minHeight={44}
              borderRadius="$control"
              backgroundColor={category === "" ? "$accent" : "$surface"}
              color={category === "" ? "$accentContrast" : "$color"}
              borderColor="$borderStrong"
              onPress={() => {
                setCategory("");
              }}
            >
              {labels.allCategories}
            </Button>
            {categories.map(([code, label]) => (
              <Button
                key={code}
                minHeight={44}
                borderRadius="$control"
                backgroundColor={category === code ? "$accent" : "$surface"}
                color={category === code ? "$accentContrast" : "$color"}
                borderColor="$borderStrong"
                onPress={() => {
                  setCategory(code);
                }}
              >
                {label}
              </Button>
            ))}
          </XStack>
        </YStack>
        <YStack gap="$calais2">
          <Text color="$mutedText" fontSize="$2" fontWeight="700">
            {labels.audienceFilter}
          </Text>
          <XStack flexWrap="wrap" gap="$calais2">
            <Button
              minHeight={44}
              borderRadius="$control"
              backgroundColor={audience === "" ? "$accent" : "$surface"}
              color={audience === "" ? "$accentContrast" : "$color"}
              borderColor="$borderStrong"
              onPress={() => {
                setAudience("");
              }}
            >
              {labels.allAudiences}
            </Button>
            {audiences.map(([code, label]) => (
              <Button
                key={code}
                minHeight={44}
                borderRadius="$control"
                backgroundColor={audience === code ? "$accent" : "$surface"}
                color={audience === code ? "$accentContrast" : "$color"}
                borderColor="$borderStrong"
                onPress={() => {
                  setAudience(code);
                }}
              >
                {label}
              </Button>
            ))}
          </XStack>
        </YStack>
        <YStack gap="$calais2">
          <Text color="$mutedText" fontSize="$2" fontWeight="700">
            {labels.serviceFilter}
          </Text>
          <XStack flexWrap="wrap" gap="$calais2">
            <Button
              minHeight={44}
              borderRadius="$control"
              backgroundColor={service === "" ? "$accent" : "$surface"}
              color={service === "" ? "$accentContrast" : "$color"}
              borderColor="$borderStrong"
              onPress={() => {
                setService("");
              }}
            >
              {labels.allServices}
            </Button>
            {services.map(([id, label]) => (
              <Button
                key={id}
                minHeight={44}
                borderRadius="$control"
                backgroundColor={service === id ? "$accent" : "$surface"}
                color={service === id ? "$accentContrast" : "$color"}
                borderColor="$borderStrong"
                onPress={() => {
                  setService(id);
                }}
              >
                {label}
              </Button>
            ))}
          </XStack>
        </YStack>
        <YStack gap="$calais2">
          <Text color="$mutedText" fontSize="$2" fontWeight="700">
            {labels.statusFilter}
          </Text>
          <XStack flexWrap="wrap" gap="$calais2">
            <Button
              minHeight={44}
              borderRadius="$control"
              backgroundColor={status === "" ? "$accent" : "$surface"}
              color={status === "" ? "$accentContrast" : "$color"}
              borderColor="$borderStrong"
              onPress={() => {
                setStatus("");
              }}
            >
              {labels.allStatuses}
            </Button>
            {statuses.map(([value, label]) => (
              <Button
                key={value}
                minHeight={44}
                borderRadius="$control"
                backgroundColor={status === value ? "$accent" : "$surface"}
                color={status === value ? "$accentContrast" : "$color"}
                borderColor="$borderStrong"
                onPress={() => {
                  setStatus(value);
                }}
              >
                {label}
              </Button>
            ))}
          </XStack>
        </YStack>
      </YStack>

      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <Text color="$mutedText" fontSize="$3" fontWeight="700">
          {labels.results.replace("{count}", String(filtered.length))}
        </Text>
        <XStack
          gap="$calais1"
          backgroundColor="$surface"
          borderRadius="$control"
        >
          <Button
            minHeight={44}
            chromeless
            backgroundColor={view === "list" ? "$accentSoft" : "transparent"}
            color={view === "list" ? "$accent" : "$mutedText"}
            onPress={() => {
              setView("list");
            }}
          >
            {labels.listView}
          </Button>
          <Button
            minHeight={44}
            chromeless
            backgroundColor={view === "map" ? "$accentSoft" : "transparent"}
            color={view === "map" ? "$accent" : "$mutedText"}
            onPress={() => {
              setView("map");
            }}
          >
            {labels.mapView}
          </Button>
        </XStack>
      </XStack>

      {filtered.length === 0 ? (
        <ContentCard alignItems="center" paddingVertical="$calais8">
          <Text color="$mutedText">{labels.empty}</Text>
        </ContentCard>
      ) : view === "list" ? (
        <YStack gap="$calais4">
          {filtered.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              labels={labels}
            />
          ))}
        </YStack>
      ) : renderMap ? (
        renderMap(filtered)
      ) : mapped.length === 0 ? (
        <ContentCard alignItems="center" paddingVertical="$calais8">
          <Text color="$mutedText">{labels.noMap}</Text>
        </ContentCard>
      ) : (
        <YStack gap="$calais4">
          <YStack
            height={440}
            position="relative"
            overflow="hidden"
            backgroundColor="$accentSoft"
            borderWidth={1}
            borderColor="$borderColor"
            borderRadius="$panel"
          >
            <YStack
              position="absolute"
              inset={20}
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$card"
              opacity={0.7}
            />
            <YStack position="absolute" top={20} left={24} right={24}>
              <Text color="$accent" fontSize="$3" fontWeight="800">
                {labels.mapTitle}
              </Text>
              <Text color="$mutedText" fontSize="$2">
                {labels.mapHint}
              </Text>
            </YStack>
            {mapped.map((activity, index) => {
              const x =
                maxLng === minLng
                  ? 50
                  : ((activity.longitude - minLng) / (maxLng - minLng)) * 72 +
                    14;
              const y =
                maxLat === minLat
                  ? 52
                  : (1 - (activity.latitude - minLat) / (maxLat - minLat)) *
                      62 +
                    22;
              const active = selected?.id === activity.id;
              return (
                <Button
                  key={activity.id}
                  position="absolute"
                  left={`${String(x)}%` as never}
                  top={`${String(y)}%` as never}
                  transform="translate(-50%, -50%)"
                  size="$4"
                  circular
                  backgroundColor={active ? "$accent" : "$surface"}
                  color={active ? "$accentContrast" : "$accent"}
                  borderWidth={2}
                  borderColor="$accent"
                  aria-label={activity.name}
                  onPress={() => {
                    setSelectedId(activity.id);
                  }}
                >
                  {index + 1}
                </Button>
              );
            })}
          </YStack>
          {selected ? (
            <ActivityCard activity={selected} labels={labels} />
          ) : null}
        </YStack>
      )}
    </YStack>
  );
}

export function PublicActivityDetailView({
  activity,
  labels,
}: {
  activity: PublicActivitySummary & {
    description: string;
    instructions: string;
    audienceLabel: string;
  };
  labels: PublicActivityLabels & {
    audience: string;
    instructions: string;
  };
}) {
  const statusLabel =
    activity.status === "cancelled"
      ? labels.statusCancelled
      : activity.status === "uncertain"
        ? labels.statusUncertain
        : activity.status === "open"
          ? labels.statusOpen
          : labels.statusClosed;
  const statusColor =
    activity.status === "cancelled"
      ? "$danger"
      : activity.status === "uncertain"
        ? "$warning"
        : activity.status === "open"
          ? "$success"
          : "$mutedText";
  const statusBackground =
    activity.status === "cancelled"
      ? "$dangerSoft"
      : activity.status === "uncertain"
        ? "$warningSoft"
        : activity.status === "open"
          ? "$successSoft"
          : "$subtle";

  const closed = activity.status === "closed";
  return (
    <ContentCard padding="$calais6" gap="$calais5">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        {closed ? (
          <YStack />
        ) : (
          <Text color="$accent" fontSize="$2" fontWeight="800">
            {activity.categoryLabel}
          </Text>
        )}
        <Text
          color={closed && activity.nextOpeningLabel ? "$danger" : statusColor}
          backgroundColor={
            closed && activity.nextOpeningLabel
              ? "$dangerSoft"
              : statusBackground
          }
          borderRadius="$control"
          paddingHorizontal="$calais3"
          paddingVertical="$calais1"
          fontWeight="700"
        >
          {closed && activity.nextOpeningLabel
            ? activity.nextOpeningLabel
            : statusLabel}
        </Text>
      </XStack>
      <H1 fontSize="$8" lineHeight="$8" fontWeight="700">
        {activity.name}
      </H1>
      <Paragraph color="$mutedText" fontSize="$4" lineHeight="$6">
        {activity.shortDescription}
      </Paragraph>
      {activity.fallbackUsed ? (
        <Text
          color="$accent"
          backgroundColor="$accentSoft"
          borderRadius="$card"
          padding="$calais4"
          fontWeight="700"
        >
          {activity.fallbackLabel}
        </Text>
      ) : null}
      <Separator borderColor="$borderColor" />
      <Paragraph whiteSpace="pre-wrap" fontSize="$4" lineHeight="$7">
        {activity.description}
      </Paragraph>
      <XStack
        gap="$calais4"
        backgroundColor="$subtle"
        padding="$calais4"
        borderRadius="$card"
        flexWrap="wrap"
        alignItems="flex-start"
      >
        {activity.coverImage ? (
          <CoverImage image={activity.coverImage} compact />
        ) : null}
        <YStack flex={1} minWidth={220} gap="$calais3">
          <Text fontSize="$3">
            <Text fontWeight="700">{labels.provider}: </Text>
            {activity.providers.length > 0
              ? activity.providers.map((provider, index) => (
                  <Text key={provider.href}>
                    {index > 0 ? ", " : null}
                    <Anchor href={provider.href} color="$accent">
                      {provider.name}
                    </Anchor>
                  </Text>
                ))
              : activity.providerNames.join(", ")}
          </Text>
          {activity.services.length > 0 ? (
            <Text fontSize="$3">
              <Text fontWeight="700">{labels.services}: </Text>
              {activity.services.map((service) => service.label).join(", ")}
            </Text>
          ) : null}
          <Text fontSize="$3">
            <Text fontWeight="700">{labels.audience}: </Text>
            {activity.audienceLabel}
          </Text>
          <Text fontSize="$3">
            <Text fontWeight="700">{labels.place}: </Text>
            {activity.mapHref ? (
              <Anchor
                href={activity.mapHref}
                target="_blank"
                rel="noreferrer"
                color="$accent"
              >
                {activity.address || activity.placeName}
              </Anchor>
            ) : (
              activity.address || activity.placeName
            )}
          </Text>
          <Text fontSize="$3">
            <Text fontWeight="700">{labels.schedule}: </Text>
            {activity.scheduleLabels.join(" · ")}
          </Text>
          <Text color="$mutedText" fontSize="$2">
            {labels.lastVerified}: {activity.lastVerifiedLabel}
          </Text>
        </YStack>
      </XStack>
      {activity.instructions ? (
        <YStack gap="$calais2">
          <Text fontWeight="800">{labels.instructions}</Text>
          <Paragraph whiteSpace="pre-wrap" fontSize="$3" lineHeight="$6">
            {activity.instructions}
          </Paragraph>
        </YStack>
      ) : null}
    </ContentCard>
  );
}

export function PublicArticleCollection({
  articles,
  labels,
}: {
  articles: PublicArticleSummary[];
  labels: PublicArticleLabels;
}) {
  if (articles.length === 0) {
    return (
      <ContentCard alignItems="center" paddingVertical="$calais8">
        <Text color="$mutedText">{labels.empty}</Text>
      </ContentCard>
    );
  }
  return (
    <YStack gap="$calais4">
      {articles.map((article) => (
        <ContentCard key={article.id}>
          {article.coverImage ? (
            <CoverImage image={article.coverImage} />
          ) : null}
          <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
            <Text color="$accent" fontSize="$2" fontWeight="800">
              {article.articleDateLabel}
            </Text>
            {article.unreliable ? (
              <Text color="$warning" fontSize="$2" fontWeight="800">
                {labels.unreliable}
              </Text>
            ) : null}
          </XStack>
          <H2 fontSize="$6" lineHeight="$6" fontWeight="700">
            {article.title}
          </H2>
          <Paragraph color="$mutedText" fontSize="$3" lineHeight="$5">
            {article.summary}
          </Paragraph>
          {article.fallbackUsed ? (
            <Text color="$accent" fontSize="$2" fontWeight="700">
              {labels.fallback}
            </Text>
          ) : null}
          <Text fontSize="$3">
            <Text fontWeight="700">{labels.publishedBy}: </Text>
            {article.ownerNames.join(", ")}
          </Text>
          <Text color="$mutedText" fontSize="$2">
            {labels.lastReviewed}: {article.lastReviewedLabel}
          </Text>
          <CardLink href={article.href}>{labels.read}</CardLink>
        </ContentCard>
      ))}
    </YStack>
  );
}

export function PublicSimulatorCollection({
  simulators,
  labels,
}: {
  simulators: PublicSimulatorSummary[];
  labels: PublicSimulatorCollectionLabels;
}) {
  if (simulators.length === 0) {
    return (
      <ContentCard alignItems="center" paddingVertical="$calais8">
        <Text color="$mutedText">{labels.empty}</Text>
      </ContentCard>
    );
  }
  return (
    <YStack gap="$calais4">
      <YStack
        padding="$calais4"
        backgroundColor="$accentSoft"
        borderRadius="$card"
      >
        <Text color="$accent" fontSize="$3" fontWeight="700">
          {labels.privacy}
        </Text>
      </YStack>
      {simulators.map((simulator) => (
        <ContentCard key={simulator.id}>
          <H2 fontSize="$6" lineHeight="$6" fontWeight="700">
            {simulator.title}
          </H2>
          <Paragraph color="$mutedText" fontSize="$3" lineHeight="$5">
            {simulator.summary}
          </Paragraph>
          <Separator borderColor="$borderColor" />
          <XStack flexWrap="wrap" gap="$calais5">
            <YStack gap="$calais1">
              <Text color="$mutedText" fontSize="$2" fontWeight="700">
                {labels.city}
              </Text>
              <Text fontSize="$3">{simulator.cityLabel}</Text>
            </YStack>
            <YStack gap="$calais1">
              <Text color="$mutedText" fontSize="$2" fontWeight="700">
                {labels.lastReviewed}
              </Text>
              <Text fontSize="$3">{simulator.lastReviewedLabel}</Text>
            </YStack>
            <YStack gap="$calais1">
              <Text color="$mutedText" fontSize="$2" fontWeight="700">
                {labels.sourceLanguage}
              </Text>
              <Text fontSize="$3">{simulator.sourceLanguageLabel}</Text>
            </YStack>
          </XStack>
          <CardLink href={simulator.href}>{labels.open}</CardLink>
        </ContentCard>
      ))}
    </YStack>
  );
}

export interface PublicArticleDetail {
  title: string;
  summary: string;
  body: string;
  articleDateLabel: string;
  lastReviewedLabel: string;
  ownerNames: string[];
  fallbackUsed: boolean;
  unreliable: boolean;
  unreliableFromLabel: string;
  coverImage: PublicContentImage | null;
}

export function PublicArticleDetailView({
  article,
  labels,
}: {
  article: PublicArticleDetail;
  labels: PublicArticleLabels;
}) {
  return (
    <ContentCard padding="$calais6" gap="$calais5">
      <Text color="$accent" fontSize="$2" fontWeight="800">
        {article.articleDateLabel}
      </Text>
      <H1 fontSize="$8" lineHeight="$8" fontWeight="700">
        {article.title}
      </H1>
      <Paragraph color="$mutedText" fontSize="$4" lineHeight="$6">
        {article.summary}
      </Paragraph>
      {article.coverImage ? <CoverImage image={article.coverImage} /> : null}
      {article.fallbackUsed ? (
        <Text
          backgroundColor="$accentSoft"
          color="$accent"
          borderRadius="$card"
          padding="$calais4"
          fontWeight="700"
        >
          {labels.fallback}
        </Text>
      ) : null}
      {article.unreliable ? (
        <Text
          backgroundColor="$warningSoft"
          color="$warning"
          borderRadius="$card"
          padding="$calais4"
          fontWeight="700"
        >
          {labels.unreliable} · {article.unreliableFromLabel}
        </Text>
      ) : null}
      <Separator borderColor="$borderColor" />
      <Paragraph
        whiteSpace="pre-wrap"
        fontSize="$4"
        lineHeight="$7"
        maxWidth={720}
      >
        {article.body}
      </Paragraph>
      <Separator borderColor="$borderColor" />
      <Text fontSize="$3">
        <Text fontWeight="700">{labels.publishedBy}: </Text>
        {article.ownerNames.join(", ")}
      </Text>
      <Text color="$mutedText" fontSize="$2">
        {labels.lastReviewed}: {article.lastReviewedLabel}
      </Text>
    </ContentCard>
  );
}
