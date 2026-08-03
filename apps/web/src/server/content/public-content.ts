import {
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { taxonomyLabel } from "@infokit/shared/i18n/taxonomy";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

import {
  activityCurrentStatus,
  nextOpening,
  type ActivityCurrentStatus,
  type NextOpening,
} from "~/lib/activity-current-status";
import { parisToday } from "~/lib/freshness";
import { type TransitLink } from "~/lib/transit-links";
import { db } from "~/server/db";
import {
  activities,
  activityAssets,
  activityProviders,
  activityPublications,
  activityServices,
  activityTransitLinks,
  activityTranslations,
  articleDetails,
  assets,
  assetTranslations,
  audienceCategories,
  basicInformationDetails,
  editorialCustodianships,
  editorialEntries,
  editorialEntryAssets,
  editorialEntryRoutes,
  editorialPublications,
  editorialRevisionOrganizations,
  editorialRevisions,
  editorialRevisionTranslations,
  organizationProfiles,
  organizationProfileTranslations,
  organizations,
  places,
  placeTranslations,
  scheduleExceptions,
  scheduleRules,
  serviceCategories,
  services,
} from "~/server/db/schema";

export interface PublishedActivity {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  instructions: string;
  categoryCode: string;
  categoryLabel: string;
  categoryIcon: string;
  audienceCode: string;
  audienceLabel: string;
  /**
   * `id` is this deployment's row, which is what the list filters on; `code` is
   * the taxonomy's own name for the service, which is what code may recognise —
   * a presenter looking for drinking water asks for the code, never the row.
   */
  services: Array<{ id: string; code: string; label: string; icon: string }>;
  providerNames: string[];
  providers: Array<{ name: string; slug: string }>;
  placeName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  precision: "exact" | "area_only" | "contact_to_learn";
  status: ActivityCurrentStatus;
  nextOpening: NextOpening | null;
  fallbackUsed: boolean;
  contentLanguage: string;
  lastVerifiedAt: Date | null;
  reviewDueAt: Date | null;
  schedules: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    endsNextDay: boolean;
  }>;
  /**
   * How to get there on public transport, in the order the editors listed. Not
   * translated and not part of the publication: a line number is a line number
   * in every language, and a reader who cannot reach the place is not served by
   * waiting for a translation of the word "bus".
   */
  transit: TransitLink[];
  coverImage: PublishedCoverImage | null;
}

export interface PublishedCoverImage {
  url: string;
  alt: string;
  decorative: boolean;
}

export interface PublishedArticle {
  id: string;
  slug: string;
  languageCode: string;
  title: string;
  summary: string;
  body: string;
  articleDate: string | null;
  ownerNames: string[];
  fallbackUsed: boolean;
  lastReviewedAt: Date | null;
  reviewDueAt: Date | null;
  unreliableFrom: string | null;
  publishedAt: Date;
  coverImage: PublishedCoverImage | null;
}

function activePublication(now: Date) {
  return and(
    isNull(activityPublications.unpublishedAt),
    or(
      isNull(activityPublications.scheduledFor),
      lte(activityPublications.scheduledFor, now),
    ),
  );
}

export async function listPublishedActivities(
  locale: PublicLocale,
): Promise<PublishedActivity[]> {
  const now = new Date();
  const publicationRows = await db
    .select({
      activityId: activities.id,
      slug: activities.slug,
      /** Null when the platform holds the activity itself; see below. */
      organizationId: activities.organizationId,
      sourceLanguage: activities.sourceLanguageCode,
      languageCode: activityPublications.languageCode,
      categoryId: activities.categoryId,
      audienceCategoryId: activities.audienceCategoryId,
      placeId: activities.placeId,
      status: activities.manualStatus,
      lastVerifiedAt: activities.lastVerifiedAt,
      reviewDueAt: activities.reviewDueAt,
    })
    .from(activities)
    .innerJoin(
      activityPublications,
      eq(activityPublications.activityId, activities.id),
    )
    .where(and(isNull(activities.archivedAt), activePublication(now)));

  const publicationsByActivity = new Map<
    string,
    (typeof publicationRows)[number][]
  >();
  for (const publication of publicationRows) {
    const rows = publicationsByActivity.get(publication.activityId) ?? [];
    rows.push(publication);
    publicationsByActivity.set(publication.activityId, rows);
  }
  const selected = [...publicationsByActivity.values()].flatMap((rows) => {
    const sourceLanguage = rows[0]?.sourceLanguage;
    const publication =
      rows.find((row) => row.languageCode === locale) ??
      rows.find((row) => row.languageCode === sourceLanguage) ??
      rows[0];
    return publication ? [publication] : [];
  });
  if (selected.length === 0) return [];

  const activityIds = selected.map((item) => item.activityId);
  const today = parisToday().isoDate;
  const placeIds = selected.flatMap((item) =>
    item.placeId ? [item.placeId] : [],
  );
  const categoryIds = selected.map((item) => item.categoryId);
  const audienceIds = selected.map((item) => item.audienceCategoryId);
  const [
    translationRows,
    categoryRows,
    audienceRows,
    placeRows,
    providerRows,
    serviceRows,
    scheduleRows,
    exceptionRows,
    transitRows,
    coverRows,
  ] = await Promise.all([
    db
      .select({
        activityId: activityTranslations.activityId,
        languageCode: activityTranslations.languageCode,
        name: activityTranslations.name,
        shortDescription: activityTranslations.shortDescription,
        description: activityTranslations.descriptionText,
        instructions: activityTranslations.instructions,
      })
      .from(activityTranslations)
      .where(inArray(activityTranslations.activityId, activityIds)),
    db
      .select({
        id: serviceCategories.id,
        code: serviceCategories.code,
        icon: serviceCategories.icon,
      })
      .from(serviceCategories)
      .where(inArray(serviceCategories.id, categoryIds)),
    db
      .select({
        id: audienceCategories.id,
        code: audienceCategories.code,
      })
      .from(audienceCategories)
      .where(inArray(audienceCategories.id, audienceIds)),
    placeIds.length === 0
      ? []
      : db
          .select({
            id: places.id,
            address: places.addressLine,
            postalCode: places.postalCode,
            latitude: places.lat,
            longitude: places.lng,
            precision: places.precision,
            languageCode: placeTranslations.languageCode,
            name: placeTranslations.name,
          })
          .from(places)
          .leftJoin(placeTranslations, eq(placeTranslations.placeId, places.id))
          .where(
            and(
              inArray(places.id, placeIds),
              eq(places.active, true),
              isNull(places.archivedAt),
            ),
          ),
    db
      .select({
        activityId: activityProviders.activityId,
        name: organizations.displayName,
        slug: organizations.slug,
      })
      .from(activityProviders)
      .innerJoin(
        organizations,
        eq(organizations.id, activityProviders.organizationId),
      )
      .where(
        and(
          inArray(activityProviders.activityId, activityIds),
          eq(activityProviders.state, "confirmed"),
          eq(activityProviders.active, true),
          eq(organizations.status, "verified"),
          eq(organizations.publishingSuspended, false),
        ),
      )
      .orderBy(asc(activityProviders.displayOrder)),
    db
      .select({
        activityId: activityServices.activityId,
        serviceId: services.id,
        code: services.code,
        icon: services.icon,
      })
      .from(activityServices)
      .innerJoin(services, eq(services.id, activityServices.serviceId))
      .where(
        and(
          inArray(activityServices.activityId, activityIds),
          eq(activityServices.active, true),
          eq(services.active, true),
          isNull(services.archivedAt),
        ),
      )
      .orderBy(asc(activityServices.displayOrder)),
    db
      .select({
        activityId: scheduleRules.activityId,
        weekday: scheduleRules.weekday,
        startTime: scheduleRules.startTime,
        endTime: scheduleRules.endTime,
        endsNextDay: scheduleRules.endsNextDay,
        validFrom: scheduleRules.validFrom,
        validTo: scheduleRules.validTo,
      })
      .from(scheduleRules)
      .where(inArray(scheduleRules.activityId, activityIds))
      .orderBy(asc(scheduleRules.weekday), asc(scheduleRules.startTime)),
    db
      .select({
        activityId: scheduleExceptions.activityId,
        date: scheduleExceptions.date,
        kind: scheduleExceptions.kind,
        startTime: scheduleExceptions.startTime,
        endTime: scheduleExceptions.endTime,
      })
      .from(scheduleExceptions)
      .where(
        and(
          inArray(scheduleExceptions.activityId, activityIds),
          eq(scheduleExceptions.date, today),
        ),
      ),
    db
      .select({
        activityId: activityTransitLinks.activityId,
        mode: activityTransitLinks.mode,
        line: activityTransitLinks.line,
        stopName: activityTransitLinks.stopName,
        walkMinutes: activityTransitLinks.walkMinutes,
      })
      .from(activityTransitLinks)
      .where(inArray(activityTransitLinks.activityId, activityIds))
      .orderBy(
        asc(activityTransitLinks.displayOrder),
        asc(activityTransitLinks.createdAt),
      ),
    db
      .select({
        activityId: activityAssets.activityId,
        assetId: assets.id,
        assetLanguage: assets.languageCode,
        languageCode: assetTranslations.languageCode,
        altText: assetTranslations.altText,
        decorative: assetTranslations.decorative,
        displayOrder: activityAssets.displayOrder,
      })
      .from(activityAssets)
      .innerJoin(assets, eq(assets.id, activityAssets.assetId))
      .leftJoin(assetTranslations, eq(assetTranslations.assetId, assets.id))
      .where(
        and(
          inArray(activityAssets.activityId, activityIds),
          eq(activityAssets.role, "cover"),
          eq(activityAssets.active, true),
          eq(assets.kind, "image"),
          eq(assets.visibility, "public"),
          eq(assets.scanState, "clean"),
          eq(assets.rightsConfirmed, true),
          isNull(assets.archivedAt),
        ),
      )
      .orderBy(asc(activityAssets.displayOrder)),
  ]);

  const coverEntries = selected.map((publication) => {
    const candidates = coverRows.filter(
      (row) => row.activityId === publication.activityId,
    );
    const cover =
      candidates.find((row) => row.languageCode === locale) ??
      candidates.find((row) => row.languageCode === publication.languageCode) ??
      candidates.find(
        (row) => row.languageCode === publication.sourceLanguage,
      ) ??
      candidates.find((row) => row.languageCode === row.assetLanguage) ??
      candidates[0];
    if (!cover) return [publication.activityId, null] as const;
    return [
      publication.activityId,
      {
        url: `/api/public/assets/${cover.assetId}`,
        alt: cover.decorative ? "" : (cover.altText ?? ""),
        decorative: cover.decorative ?? false,
      },
    ] as const;
  });
  const covers = new Map(coverEntries);

  return selected.flatMap((publication) => {
    const providers = providerRows
      .filter((row) => row.activityId === publication.activityId)
      .map((row) => ({ name: row.name, slug: row.slug }));
    /**
     * An organisation's activity is published on its providers' account, so it
     * leaves the public read the moment none of them is still confirmed and
     * verified — a suspension takes their content down with them. An activity
     * the platform holds has no provider by design and the platform answers for
     * it, so nothing here withholds it.
     */
    if (providers.length === 0 && publication.organizationId !== null)
      return [];
    const providerNames = providers.map((provider) => provider.name);
    const localized =
      translationRows.find(
        (row) =>
          row.activityId === publication.activityId &&
          row.languageCode === publication.languageCode,
      ) ??
      translationRows.find(
        (row) =>
          row.activityId === publication.activityId &&
          row.languageCode === publication.sourceLanguage,
      );
    if (!localized) return [];
    const category = categoryRows.find(
      (row) => row.id === publication.categoryId,
    );
    const audience = audienceRows.find(
      (row) => row.id === publication.audienceCategoryId,
    );
    const activityServiceRows = serviceRows.filter(
      (row) => row.activityId === publication.activityId,
    );
    const seenServiceIds = new Set<string>();
    const localizedServices = activityServiceRows.flatMap((row) => {
      if (seenServiceIds.has(row.serviceId)) return [];
      seenServiceIds.add(row.serviceId);
      return [
        {
          id: row.serviceId,
          code: row.code ?? "",
          label: taxonomyLabel("services", row.code ?? "", locale),
          icon: row.icon,
        },
      ];
    });
    const placeCandidates = placeRows.filter(
      (row) => row.id === publication.placeId,
    );
    const place =
      placeCandidates.find((row) => row.languageCode === locale) ??
      placeCandidates.find(
        (row) => row.languageCode === publication.languageCode,
      ) ??
      placeCandidates[0];
    const exact = place?.precision === "exact";
    const activitySchedules = scheduleRows.filter(
      (row) => row.activityId === publication.activityId,
    );
    const activityStatus = activityCurrentStatus({
      now,
      manualStatus: publication.status,
      rules: activitySchedules,
      exceptions: exceptionRows.filter(
        (row) => row.activityId === publication.activityId,
      ),
    });
    return [
      {
        id: publication.activityId,
        slug: publication.slug ?? publication.activityId,
        name: localized.name,
        shortDescription: localized.shortDescription ?? "",
        description: localized.description ?? "",
        instructions: localized.instructions ?? "",
        categoryCode: category?.code ?? "info",
        categoryLabel: category
          ? taxonomyLabel("categories", category.code, locale)
          : "",
        categoryIcon: category?.icon ?? "info",
        audienceCode: audience?.code ?? publication.audienceCategoryId,
        audienceLabel: audience
          ? taxonomyLabel("audiences", audience.code, locale)
          : "",
        services: localizedServices,
        providerNames,
        providers,
        placeName:
          place?.precision === "contact_to_learn" ? "" : (place?.name ?? ""),
        address: exact
          ? [place.address, place.postalCode].filter(Boolean).join(", ")
          : "",
        latitude: exact ? (place.latitude ?? null) : null,
        longitude: exact ? (place.longitude ?? null) : null,
        precision: place?.precision ?? "contact_to_learn",
        status: activityStatus,
        nextOpening:
          activityStatus === "closed"
            ? nextOpening({ now, rules: activitySchedules })
            : null,
        fallbackUsed: publication.languageCode !== locale,
        contentLanguage: publication.languageCode,
        lastVerifiedAt: publication.lastVerifiedAt,
        reviewDueAt: publication.reviewDueAt,
        schedules: activitySchedules,
        transit: transitRows
          .filter((row) => row.activityId === publication.activityId)
          .map((row): TransitLink => ({
            mode: row.mode,
            line: row.line,
            stopName: row.stopName,
            walkMinutes: row.walkMinutes,
          })),
        coverImage: covers.get(publication.activityId) ?? null,
      },
    ];
  });
}

export async function loadPublishedActivityBySlug(
  slug: string,
  locale: PublicLocale,
): Promise<PublishedActivity | null> {
  return (
    (await listPublishedActivities(locale)).find(
      (activity) => activity.slug === slug,
    ) ?? null
  );
}

export async function listPublishedArticles(
  locale: PublicLocale,
): Promise<PublishedArticle[]> {
  const now = new Date();
  const rows = await db
    .select({
      entryId: editorialEntries.id,
      revisionId: editorialRevisions.id,
      sourceLanguage: editorialRevisions.sourceLanguageCode,
      languageCode: editorialPublications.languageCode,
      slug: editorialEntryRoutes.slug,
      title: editorialRevisionTranslations.title,
      summary: editorialRevisionTranslations.summary,
      body: editorialRevisionTranslations.plainText,
      articleDate: articleDetails.articleDate,
      lastReviewedAt: editorialRevisions.lastReviewedAt,
      reviewDueAt: editorialRevisions.reviewDueAt,
      unreliableFrom: editorialRevisions.unreliableFrom,
      publishedAt: editorialPublications.publishedAt,
    })
    .from(editorialEntries)
    .innerJoin(
      editorialPublications,
      eq(editorialPublications.entryId, editorialEntries.id),
    )
    .innerJoin(
      editorialRevisions,
      eq(editorialRevisions.id, editorialPublications.revisionId),
    )
    .innerJoin(
      editorialRevisionTranslations,
      and(
        eq(
          editorialRevisionTranslations.revisionId,
          editorialPublications.revisionId,
        ),
        eq(
          editorialRevisionTranslations.languageCode,
          editorialPublications.languageCode,
        ),
      ),
    )
    .innerJoin(
      editorialEntryRoutes,
      and(
        eq(editorialEntryRoutes.entryId, editorialEntries.id),
        eq(
          editorialEntryRoutes.languageCode,
          editorialPublications.languageCode,
        ),
        isNull(editorialEntryRoutes.retiredAt),
      ),
    )
    .innerJoin(articleDetails, eq(articleDetails.entryId, editorialEntries.id))
    .where(
      and(
        eq(editorialEntries.kind, "article"),
        isNull(editorialEntries.archivedAt),
        isNull(editorialPublications.unpublishedAt),
        or(
          isNull(editorialPublications.scheduledFor),
          lte(editorialPublications.scheduledFor, now),
        ),
      ),
    );
  const rowsByEntry = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) {
    const entries = rowsByEntry.get(row.entryId) ?? [];
    entries.push(row);
    rowsByEntry.set(row.entryId, entries);
  }
  const selected = [...rowsByEntry.values()].flatMap((entryRows) => {
    const sourceLanguage = entryRows[0]?.sourceLanguage;
    const row =
      entryRows.find((candidate) => candidate.languageCode === locale) ??
      entryRows.find(
        (candidate) => candidate.languageCode === sourceLanguage,
      ) ??
      entryRows[0];
    return row ? [row] : [];
  });
  if (selected.length === 0) return [];

  const [ownerRows, coverRows] = await Promise.all([
    db
      .select({
        revisionId: editorialRevisionOrganizations.revisionId,
        name: organizations.displayName,
      })
      .from(editorialRevisionOrganizations)
      .innerJoin(
        organizations,
        eq(organizations.id, editorialRevisionOrganizations.organizationId),
      )
      .where(
        and(
          inArray(
            editorialRevisionOrganizations.revisionId,
            selected.map((row) => row.revisionId),
          ),
          eq(organizations.status, "verified"),
          eq(organizations.publishingSuspended, false),
        ),
      ),
    db
      .select({
        entryId: editorialEntryAssets.entryId,
        assetId: assets.id,
        assetLanguage: assets.languageCode,
        languageCode: assetTranslations.languageCode,
        altText: assetTranslations.altText,
        decorative: assetTranslations.decorative,
        displayOrder: editorialEntryAssets.displayOrder,
      })
      .from(editorialEntryAssets)
      .innerJoin(assets, eq(assets.id, editorialEntryAssets.assetId))
      .leftJoin(assetTranslations, eq(assetTranslations.assetId, assets.id))
      .where(
        and(
          inArray(
            editorialEntryAssets.entryId,
            selected.map((row) => row.entryId),
          ),
          eq(editorialEntryAssets.role, "cover"),
          eq(assets.kind, "image"),
          eq(assets.visibility, "public"),
          eq(assets.scanState, "clean"),
          eq(assets.rightsConfirmed, true),
          isNull(assets.archivedAt),
        ),
      )
      .orderBy(asc(editorialEntryAssets.displayOrder)),
  ]);

  return selected.map((row) => {
    const candidates = coverRows.filter(
      (cover) => cover.entryId === row.entryId,
    );
    const cover =
      candidates.find((candidate) => candidate.languageCode === locale) ??
      candidates.find(
        (candidate) => candidate.languageCode === row.languageCode,
      ) ??
      candidates.find(
        (candidate) => candidate.languageCode === row.sourceLanguage,
      ) ??
      candidates.find(
        (candidate) => candidate.languageCode === candidate.assetLanguage,
      ) ??
      candidates[0];
    return {
      id: row.entryId,
      slug: row.slug,
      languageCode: row.languageCode,
      title: row.title,
      summary: row.summary ?? "",
      body: row.body ?? "",
      articleDate: row.articleDate,
      ownerNames: ownerRows
        .filter((owner) => owner.revisionId === row.revisionId)
        .map((owner) => owner.name),
      fallbackUsed: row.languageCode !== locale,
      lastReviewedAt: row.lastReviewedAt,
      reviewDueAt: row.reviewDueAt,
      unreliableFrom: row.unreliableFrom,
      publishedAt: row.publishedAt,
      coverImage: cover
        ? {
            url: `/api/public/assets/${cover.assetId}`,
            alt: cover.decorative ? "" : (cover.altText ?? ""),
            decorative: cover.decorative ?? false,
          }
        : null,
    };
  });
}

export async function loadPublishedArticle(
  slug: string,
  locale: PublicLocale,
): Promise<PublishedArticle | null> {
  const [route] = await db
    .select({ entryId: editorialEntryRoutes.entryId })
    .from(editorialEntryRoutes)
    .where(
      and(
        eq(editorialEntryRoutes.slug, slug),
        isNull(editorialEntryRoutes.retiredAt),
      ),
    )
    .limit(1);
  if (!route) return null;
  return (
    (await listPublishedArticles(locale)).find(
      (article) => article.id === route.entryId,
    ) ?? null
  );
}

export interface PublishedArticleRoutes {
  entryId: string;
  /** The slug a reader in each locale is served, keyed by locale. */
  slugs: Record<PublicLocale, string>;
  lastModified: Date;
}

/**
 * Where each published article lives in every public language.
 *
 * An article's slug is generated from its own title per language, so the same
 * read sits at a different path in each locale. Both the sitemap and a detail
 * page's hreflang need that whole map — and the language actually served for a
 * locale is resolved with the same precedence `listPublishedArticles` uses, so
 * a locale without its own translation points at the path it really renders.
 *
 * `slug` narrows to the one entry a live route belongs to, whichever language
 * that route is in. A detail page knows only the slug it was asked for, so
 * keying on that lets it read its hreflang map beside the article instead of a
 * round trip behind it — see the note in `articles/[slug]/page.tsx`.
 */
export async function listPublishedArticleRoutes(
  slug?: string,
): Promise<PublishedArticleRoutes[]> {
  const now = new Date();
  const rows = await db
    .select({
      entryId: editorialEntries.id,
      sourceLanguage: editorialRevisions.sourceLanguageCode,
      languageCode: editorialPublications.languageCode,
      slug: editorialEntryRoutes.slug,
      publishedAt: editorialPublications.publishedAt,
      lastReviewedAt: editorialRevisions.lastReviewedAt,
    })
    .from(editorialEntries)
    .innerJoin(
      editorialPublications,
      eq(editorialPublications.entryId, editorialEntries.id),
    )
    .innerJoin(
      editorialRevisions,
      eq(editorialRevisions.id, editorialPublications.revisionId),
    )
    .innerJoin(
      editorialEntryRoutes,
      and(
        eq(editorialEntryRoutes.entryId, editorialEntries.id),
        eq(
          editorialEntryRoutes.languageCode,
          editorialPublications.languageCode,
        ),
        isNull(editorialEntryRoutes.retiredAt),
      ),
    )
    .where(
      and(
        eq(editorialEntries.kind, "article"),
        isNull(editorialEntries.archivedAt),
        isNull(editorialPublications.unpublishedAt),
        or(
          isNull(editorialPublications.scheduledFor),
          lte(editorialPublications.scheduledFor, now),
        ),
        slug
          ? inArray(
              editorialEntries.id,
              db
                .select({ entryId: editorialEntryRoutes.entryId })
                .from(editorialEntryRoutes)
                .where(
                  and(
                    eq(editorialEntryRoutes.slug, slug),
                    // A retired slug names no page, matching how
                    // `loadPublishedArticle` resolves the same URL.
                    isNull(editorialEntryRoutes.retiredAt),
                  ),
                ),
            )
          : undefined,
      ),
    );

  const byEntry = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) {
    const entryRows = byEntry.get(row.entryId) ?? [];
    entryRows.push(row);
    byEntry.set(row.entryId, entryRows);
  }

  return [...byEntry.entries()].flatMap(([id, entryRows]) => {
    const sourceLanguage = entryRows[0]?.sourceLanguage;
    const slugs = Object.fromEntries(
      publicSupportedLocales.flatMap((locale) => {
        const served =
          entryRows.find((row) => row.languageCode === locale) ??
          entryRows.find((row) => row.languageCode === sourceLanguage) ??
          entryRows[0];
        return served ? [[locale, served.slug] as const] : [];
      }),
    ) as Record<PublicLocale, string>;
    const stamps = entryRows.map((row) =>
      (row.lastReviewedAt ?? row.publishedAt).getTime(),
    );
    return stamps.length > 0
      ? [{ entryId: id, slugs, lastModified: new Date(Math.max(...stamps)) }]
      : [];
  });
}

export interface PublishedOrganizationSummary {
  slug: string;
  displayName: string;
  lastModified: Date;
}

/**
 * Every organisation whose public page exists, for the sitemap.
 *
 * The conditions mirror `loadPublishedOrganization` down to the verified
 * translation it needs to render, because a listed URL that answers 404 is
 * worse for a crawler than one that was never announced.
 */
export async function listPublishedOrganizations(): Promise<
  PublishedOrganizationSummary[]
> {
  const rows = await db
    .selectDistinct({
      slug: organizations.slug,
      displayName: organizations.displayName,
      lastModified: organizationProfiles.updatedAt,
    })
    .from(organizations)
    .innerJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, organizations.id),
    )
    .innerJoin(
      organizationProfileTranslations,
      and(
        eq(organizationProfileTranslations.organizationId, organizations.id),
        eq(organizationProfileTranslations.state, "verified"),
      ),
    )
    .where(
      and(
        eq(organizations.status, "verified"),
        eq(organizations.publishingSuspended, false),
        eq(organizationProfiles.published, true),
      ),
    );
  return rows;
}

export interface PublishedOrganization {
  slug: string;
  displayName: string;
  foundedYear: number | null;
  website: string | null;
  purpose: string;
  goals: string | null;
  values: string | null;
  fallbackUsed: boolean;
  contentLanguage: string;
}

/**
 * Public organisation profile by slug. Only verified, non-suspended
 * organisations with a published profile are exposed; the localized profile
 * text falls back to French when the requested language is not yet reviewed.
 */
export async function loadPublishedOrganization(
  slug: string,
  locale: PublicLocale,
): Promise<PublishedOrganization | null> {
  const [org] = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      displayName: organizations.displayName,
      foundedYear: organizations.foundedYear,
      website: organizationProfiles.website,
    })
    .from(organizations)
    .innerJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizations.slug, slug),
        eq(organizations.status, "verified"),
        eq(organizations.publishingSuspended, false),
        eq(organizationProfiles.published, true),
      ),
    )
    .limit(1);
  if (!org) return null;

  const translations = await db
    .select({
      languageCode: organizationProfileTranslations.languageCode,
      purpose: organizationProfileTranslations.purpose,
      goals: organizationProfileTranslations.goals,
      values: organizationProfileTranslations.values,
    })
    .from(organizationProfileTranslations)
    .where(
      and(
        eq(organizationProfileTranslations.organizationId, org.id),
        eq(organizationProfileTranslations.state, "verified"),
      ),
    );
  const localized =
    translations.find((row) => row.languageCode === locale) ??
    translations.find((row) => row.languageCode === "fr") ??
    translations[0];
  if (!localized) return null;

  return {
    slug: org.slug,
    displayName: org.displayName,
    foundedYear: org.foundedYear,
    website: org.website,
    purpose: localized.purpose,
    goals: localized.goals,
    values: localized.values,
    fallbackUsed: localized.languageCode !== locale,
    contentLanguage: localized.languageCode,
  };
}

/**
 * One published basic-information tile: a number to press, or a page to open.
 *
 * The words are editorial — authored, translated and reviewed like any other
 * entry — and everything a translator must never touch is beside them: the
 * digits, how they are reached, and whose phone rings. That last one,
 * `operator`, is what the home page splits its two blocks on.
 */
export interface PublishedBasicInformation {
  id: string;
  slug: string;
  languageCode: string;
  /** True when the reader's own language had no publication of this tile. */
  fallbackUsed: boolean;
  title: string;
  /**
   * The sentence saying when to use this. Nullable because the column is: a
   * tile can be published as a bare label and a number, and a card with no
   * sentence is better than one padded with invented context.
   */
  summary: string | null;
  icon: string;
  priority: number;
  /** The one number for danger, drawn loudest. At most one tile carries it. */
  emergency: boolean;
  operator: "state" | "association";
  /** The digits as published, or null for a tile that opens a page. */
  dial: string | null;
  reach: "voice" | "sms" | "whatsapp" | null;
  /** The number actually pressed, when that is not the one printed. */
  dialInstead: string | null;
  /** The association whose phone this is, or null for a state number. */
  answeredBy: string | null;
  /**
   * Who maintains the record right now: the platform, or the organisation whose
   * phone rings. It is the only fact the database holds that answers "has anyone
   * on the other end of this line stood behind what it says" — the platform can
   * copy a number out of a printed guide, but only the association can take the
   * record on. The public surface turns it into the card's badge
   * (`public-basics-payload.ts`); `lastReviewedAt` cannot do that job, because a
   * platform editor rechecking a copied number also stamps that.
   */
  custodian: "platform" | "organization" | null;
  lastReviewedAt: Date | null;
  reviewDueAt: Date | null;
}

/**
 * Every basic-information tile that is published, in the reader's language.
 *
 * Read exactly the way `listPublishedArticles` reads articles — same join to
 * `editorial_publications`, same unpublish and schedule conditions, same
 * language fallback — because these are editorial entries and the rule for what
 * is public should not be re-invented per kind.
 *
 * The fallback matters more here than elsewhere. Eight of the eleven languages
 * are only partly translated, so a tile may have no publication in the reader's
 * language; falling back to the source language shows them a sentence they may
 * not read, next to a number they can dial anyway. A tile withheld because its
 * wording is missing would take the number with it, which is the worse failure.
 */
export async function listPublishedBasicInformation(
  locale: PublicLocale,
): Promise<PublishedBasicInformation[]> {
  const now = new Date();
  const rows = await db
    .select({
      entryId: editorialEntries.id,
      slug: editorialEntries.slug,
      sourceLanguage: editorialRevisions.sourceLanguageCode,
      languageCode: editorialPublications.languageCode,
      title: editorialRevisionTranslations.title,
      summary: editorialRevisionTranslations.summary,
      icon: basicInformationDetails.icon,
      priority: basicInformationDetails.priority,
      emergency: basicInformationDetails.emergency,
      operator: basicInformationDetails.operator,
      dial: basicInformationDetails.dial,
      reach: basicInformationDetails.reach,
      dialInstead: basicInformationDetails.dialInstead,
      answeredBy: organizations.displayName,
      custodian: editorialCustodianships.custodianKind,
      lastReviewedAt: editorialRevisions.lastReviewedAt,
      reviewDueAt: editorialRevisions.reviewDueAt,
    })
    .from(editorialEntries)
    .innerJoin(
      editorialPublications,
      eq(editorialPublications.entryId, editorialEntries.id),
    )
    .innerJoin(
      editorialRevisions,
      eq(editorialRevisions.id, editorialPublications.revisionId),
    )
    .innerJoin(
      editorialRevisionTranslations,
      and(
        eq(
          editorialRevisionTranslations.revisionId,
          editorialPublications.revisionId,
        ),
        eq(
          editorialRevisionTranslations.languageCode,
          editorialPublications.languageCode,
        ),
      ),
    )
    .innerJoin(
      basicInformationDetails,
      eq(basicInformationDetails.entryId, editorialEntries.id),
    )
    // Left, not inner: a state number has no association behind it, and an inner
    // join would silently drop 112.
    .leftJoin(
      organizations,
      eq(organizations.id, basicInformationDetails.answeredByOrganizationId),
    )
    // The custody in force, if any. One row at most: the table's unique index
    // allows a single open custodianship per entry, so this cannot multiply the
    // rows the language fallback below is choosing between.
    .leftJoin(
      editorialCustodianships,
      and(
        eq(editorialCustodianships.entryId, editorialEntries.id),
        isNull(editorialCustodianships.endedAt),
      ),
    )
    .where(
      and(
        eq(editorialEntries.kind, "basic_information"),
        isNull(editorialEntries.archivedAt),
        isNull(editorialPublications.unpublishedAt),
        or(
          isNull(editorialPublications.scheduledFor),
          lte(editorialPublications.scheduledFor, now),
        ),
      ),
    );

  const rowsByEntry = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) {
    const entries = rowsByEntry.get(row.entryId) ?? [];
    entries.push(row);
    rowsByEntry.set(row.entryId, entries);
  }

  return (
    [...rowsByEntry.values()]
      .flatMap((entryRows) => {
        const sourceLanguage = entryRows[0]?.sourceLanguage;
        const row =
          entryRows.find((candidate) => candidate.languageCode === locale) ??
          entryRows.find(
            (candidate) => candidate.languageCode === sourceLanguage,
          ) ??
          entryRows[0];
        return row ? [row] : [];
      })
      .map((row) => ({
        id: row.entryId,
        slug: row.slug,
        languageCode: row.languageCode,
        fallbackUsed: row.languageCode !== locale,
        title: row.title,
        summary: row.summary,
        icon: row.icon,
        priority: row.priority,
        emergency: row.emergency,
        operator: row.operator,
        dial: row.dial,
        reach: row.reach,
        dialInstead: row.dialInstead,
        answeredBy: row.answeredBy,
        custodian: row.custodian,
        lastReviewedAt: row.lastReviewedAt,
        reviewDueAt: row.reviewDueAt,
      }))
      // `priority` is the editor's ordering and is spaced by ten so a number can
      // be slotted between two others without renumbering the block.
      .sort((a, b) => a.priority - b.priority)
  );
}
