import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  MapPin,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { ActivityEditorForm } from "~/components/admin/activity-content-form";
import { ActivityMediaManager } from "~/components/admin/activity-media-manager";
import { ActivityScheduleForm } from "~/components/admin/activity-schedule-form";
import { ActivityScheduleRules } from "~/components/admin/activity-schedule-rules";
import { ActivityServiceManager } from "~/components/admin/activity-service-manager";
import { ActivityTranslationPanel } from "~/components/admin/activity-translation-panel";
import { StewardContactForm } from "~/components/admin/steward-contact-form";
import type { WorkspaceTranslation } from "~/components/admin/translation-workspace";
import { WorkspacePage } from "~/components/admin/workspace";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import { ScrollArea } from "~/components/ui/scroll-area";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  editorialLanguageCodes,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import { createAssetReadUrl } from "~/server/assets/s3";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { hasActualPlatformPermission } from "~/server/auth/authorization";
import { hasPermission } from "~/server/auth/require";
import {
  activities,
  activityAssets,
  activityPublications,
  activityServices,
  activityTags,
  activityTranslations,
  assets,
  assetTranslations,
  audienceCategories,
  audienceCategoryTranslations,
  cities,
  cityTeams,
  cityTranslations,
  downloads,
  downloadTranslations,
  organizations,
  scheduleRules,
  serviceCategories,
  serviceCategoryTranslations,
  services,
  serviceTranslations,
  tags,
  tagTranslations,
  translationAssignments,
  users,
} from "~/server/db/schema";
import { updateActivitySteward } from "../steward-actions";

const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;

const activityStates = [
  "published",
  "scheduled",
  "draft",
  "cancelled",
  "uncertain",
] as const;
type ActivityState = (typeof activityStates)[number];

const stateBadge: Record<ActivityState, "default" | "secondary" | "outline"> = {
  published: "default",
  scheduled: "secondary",
  draft: "outline",
  cancelled: "secondary",
  uncertain: "secondary",
};

function activityState(row: {
  manualStatus: string;
  published: boolean;
  scheduled: boolean;
}): ActivityState {
  if (row.manualStatus === "cancelled") return "cancelled";
  if (row.manualStatus === "uncertain") return "uncertain";
  if (row.published) return "published";
  if (row.scheduled) return "scheduled";
  return "draft";
}

function localeDate(value: Date | string | null, locale: string) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime()))
    return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function localePublicationDateTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(value);
}

export default async function ActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ activity?: string; q?: string; status?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const search = await searchParams;
  const [t, overviewLabels, translationLabels] = await Promise.all([
    loadPageCatalog(locale, "dashboard-console"),
    loadPageCatalog(locale, "dashboard-overview"),
    loadPageCatalog(locale, "dashboard-articles"),
  ]);
  const session = await auth();
  const canManageGlobal = Boolean(
    session?.user.id &&
    (await hasActualPlatformPermission(session.user.id, "support.superadmin")),
  );

  // Rich-text editor toolbar/field labels reuse the create catalogue.
  const editorLabels: Record<string, string> = {};
  for (const [key, value] of Object.entries(overviewLabels)) {
    if (key.startsWith("create.")) {
      editorLabels[key.replace(/^create\./, "")] = value;
    }
  }
  for (const language of editorialLanguageCodes) {
    editorLabels[`language.${language}`] = t[`language.${language}`];
  }

  // ---- Activity list ----------------------------------------------------
  const activityRows = await db
    .select({
      id: activities.id,
      organizationId: activities.organizationId,
      cityId: activities.cityId,
      teamId: activities.teamId,
      published: activities.published,
      manualStatus: activities.manualStatus,
      sourceLanguageCode: activities.sourceLanguageCode,
      categoryId: activities.categoryId,
      audienceCategoryId: activities.audienceCategoryId,
      updatedAt: activities.updatedAt,
      reviewDueAt: activities.reviewDueAt,
      // Workspace-only: who to ask about this activity. Never read publicly.
      stewardName: activities.stewardName,
      stewardPhone: activities.stewardPhone,
      stewardEmail: activities.stewardEmail,
      organization: organizations.displayName,
      cityCode: cities.code,
      cityName: cityTranslations.name,
      teamName: cityTeams.name,
    })
    .from(activities)
    .innerJoin(organizations, eq(activities.organizationId, organizations.id))
    // A global activity belongs to no city and therefore to no city team, so
    // both joins are outer: requiring them would hide those rows entirely.
    .leftJoin(cities, eq(activities.cityId, cities.id))
    .leftJoin(cityTeams, eq(activities.teamId, cityTeams.id))
    .leftJoin(
      cityTranslations,
      and(
        eq(cityTranslations.cityId, cities.id),
        eq(cityTranslations.languageCode, locale),
      ),
    )
    .where(isNull(activities.archivedAt))
    .orderBy(asc(organizations.displayName), asc(cities.code));
  const rows = activityRows.map((activity) => {
    if (!activity.organizationId) {
      throw new Error(
        "Claimed activity query returned an unassigned organization",
      );
    }
    return {
      ...activity,
      organizationId: activity.organizationId,
    };
  });
  const ids = rows.map((row) => row.id);
  const nameRows = ids.length
    ? await db
        .select({
          activityId: activityTranslations.activityId,
          languageCode: activityTranslations.languageCode,
          name: activityTranslations.name,
        })
        .from(activityTranslations)
        .where(inArray(activityTranslations.activityId, ids))
    : [];
  const namesById = new Map<string, typeof nameRows>();
  for (const row of nameRows) {
    const current = namesById.get(row.activityId) ?? [];
    current.push(row);
    namesById.set(row.activityId, current);
  }
  const getName = (id: string) => {
    const names = namesById.get(id) ?? [];
    return (
      names.find((row) => row.languageCode === locale)?.name ??
      names.find((row) => row.languageCode === "fr")?.name ??
      names[0]?.name ??
      t["activities.untitled"]
    );
  };

  const publicationRows = ids.length
    ? await db
        .select({
          activityId: activityPublications.activityId,
          languageCode: activityPublications.languageCode,
          publishedAt: activityPublications.publishedAt,
          scheduledFor: activityPublications.scheduledFor,
        })
        .from(activityPublications)
        .where(
          and(
            inArray(activityPublications.activityId, ids),
            isNull(activityPublications.unpublishedAt),
          ),
        )
    : [];
  const publishedLanguagesById = new Map<string, string[]>();
  const scheduledLanguagesById = new Map<string, string[]>();
  const publicationNow = new Date();
  for (const row of publicationRows) {
    const scheduled = row.scheduledFor && row.scheduledFor > publicationNow;
    const target = scheduled ? scheduledLanguagesById : publishedLanguagesById;
    target.set(row.activityId, [
      ...(target.get(row.activityId) ?? []),
      row.languageCode,
    ]);
  }

  const now = new Date();
  const list = rows.map((row) => ({
    ...row,
    title: getName(row.id),
    /** Where this activity applies: one city, or everywhere. */
    scopeLabel: row.cityName ?? row.cityCode ?? t["activity.scopeGlobal"],
    state: activityState({
      ...row,
      published: (publishedLanguagesById.get(row.id) ?? []).length > 0,
      scheduled: (scheduledLanguagesById.get(row.id) ?? []).length > 0,
    }),
    publishedLanguages: publishedLanguagesById.get(row.id) ?? [],
    reviewDue: row.reviewDueAt !== null && row.reviewDueAt <= now,
  }));

  const query = search.q?.trim().toLocaleLowerCase(locale) ?? "";
  const requestedStatus = activityStates.includes(
    search.status as ActivityState,
  )
    ? (search.status as ActivityState)
    : "";
  const filtered = list.filter((activity) => {
    const matchesStatus =
      !requestedStatus || activity.state === requestedStatus;
    const searchable =
      `${activity.title} ${activity.organization} ${activity.scopeLabel}`.toLocaleLowerCase(
        locale,
      );
    return matchesStatus && (!query || searchable.includes(query));
  });
  const publishedCount = list.filter(
    (activity) => activity.state === "published",
  ).length;
  const attentionCount = list.filter(
    (activity) => activity.state !== "published" || activity.reviewDue,
  ).length;

  const selected = search.activity
    ? list.find((row) => row.id === search.activity)
    : undefined;

  // ---- Selected activity detail ----------------------------------------
  const [
    initialTranslationRows,
    assignedServices,
    scheduleRows,
    serviceCatalogRows,
    serviceCatalogTranslations,
    categoryRows,
  ] = selected
    ? await Promise.all([
        db
          .select({
            languageCode: activityTranslations.languageCode,
            name: activityTranslations.name,
            descriptionHtml: activityTranslations.descriptionHtml,
            descriptionText: activityTranslations.descriptionText,
            state: activityTranslations.state,
            method: activityTranslations.method,
            verifiedById: activityTranslations.verifiedById,
            verifiedByName: users.name,
            // Set when the source moved after this language was last checked.
            carriedForwardFrom:
              activityTranslations.carriedForwardFromSourceVersionId,
          })
          .from(activityTranslations)
          .leftJoin(users, eq(users.id, activityTranslations.verifiedById))
          .where(eq(activityTranslations.activityId, selected.id)),
        db
          .select({ id: services.id })
          .from(activityServices)
          .innerJoin(services, eq(activityServices.serviceId, services.id))
          .where(
            and(
              eq(activityServices.activityId, selected.id),
              eq(activityServices.active, true),
            ),
          ),
        db
          .select()
          .from(scheduleRules)
          .where(eq(scheduleRules.activityId, selected.id))
          .orderBy(asc(scheduleRules.weekday), asc(scheduleRules.startTime)),
        db
          .select({
            id: services.id,
            organizationId: services.organizationId,
            categoryId: services.categoryId,
            icon: services.icon,
            active: services.active,
            archivedAt: services.archivedAt,
            sourceNote: services.sourceNote,
            categoryCode: serviceCategories.code,
            categoryIcon: serviceCategories.icon,
            categoryLabel: serviceCategoryTranslations.label,
          })
          .from(services)
          .innerJoin(
            serviceCategories,
            eq(services.categoryId, serviceCategories.id),
          )
          .leftJoin(
            serviceCategoryTranslations,
            and(
              eq(serviceCategoryTranslations.categoryId, serviceCategories.id),
              eq(serviceCategoryTranslations.languageCode, locale),
            ),
          )
          .where(
            or(
              isNull(services.organizationId),
              eq(services.organizationId, selected.organizationId),
            ),
          )
          .orderBy(asc(serviceCategories.displayOrder)),
        db.select().from(serviceTranslations),
        db
          .select({
            id: serviceCategories.id,
            label: serviceCategoryTranslations.label,
            code: serviceCategories.code,
            icon: serviceCategories.icon,
          })
          .from(serviceCategories)
          .leftJoin(
            serviceCategoryTranslations,
            and(
              eq(serviceCategoryTranslations.categoryId, serviceCategories.id),
              eq(serviceCategoryTranslations.languageCode, locale),
            ),
          )
          .where(eq(serviceCategories.enabled, true))
          .orderBy(asc(serviceCategories.displayOrder)),
      ])
    : [[], [], [], [], [], []];

  const initialContent: Partial<
    Record<EditorialLanguage, WorkspaceTranslation>
  > = {};
  for (const row of initialTranslationRows) {
    if (
      editorialLanguageCodes.includes(row.languageCode as EditorialLanguage)
    ) {
      initialContent[row.languageCode as EditorialLanguage] = {
        title: row.name,
        html: row.descriptionHtml ?? "",
        text: row.descriptionText ?? "",
        state: row.state,
        method: row.method,
        verifiedByName: row.verifiedByName,
        stale: row.carriedForwardFrom !== null,
      };
    }
  }
  // Rendering the verify control is a read-side decision; the action re-checks.
  const canVerifyTranslations = selected
    ? await hasPermission("content.translation.verify", selected.organizationId)
    : false;

  // ---- Classification, translator, and media (selected activity only) --
  const countWords = (value: string) =>
    value.trim() ? value.trim().split(/\s+/).length : 0;
  const sourceRow = initialTranslationRows.find(
    (row) => row.languageCode === selected?.sourceLanguageCode,
  );
  const sourceWordCount = selected
    ? countWords(`${sourceRow?.name ?? ""} ${sourceRow?.descriptionText ?? ""}`)
    : 0;

  const [
    assignmentRows,
    categoryOptionRows,
    audienceOptionRows,
    tagOptionRows,
    currentTagRows,
    coverRows,
    downloadRows,
  ] = selected
    ? await Promise.all([
        db
          .select({
            id: translationAssignments.id,
            languageCode: translationAssignments.targetLanguageCode,
            state: translationAssignments.state,
            translatorEmail: translationAssignments.translatorEmail,
            translatorName: translationAssignments.translatorName,
            expiresAt: translationAssignments.expiresAt,
            submittedContent: translationAssignments.submittedContentJson,
            reviewNote: translationAssignments.reviewNote,
          })
          .from(translationAssignments)
          .where(
            and(
              eq(translationAssignments.entityKind, "activity"),
              eq(translationAssignments.entityId, selected.id),
              isNull(translationAssignments.revokedAt),
              isNull(translationAssignments.expiredAt),
            ),
          )
          .orderBy(desc(translationAssignments.createdAt)),
        db
          .select({
            id: serviceCategories.id,
            code: serviceCategories.code,
            label: serviceCategoryTranslations.label,
          })
          .from(serviceCategories)
          .leftJoin(
            serviceCategoryTranslations,
            and(
              eq(serviceCategoryTranslations.categoryId, serviceCategories.id),
              eq(serviceCategoryTranslations.languageCode, locale),
            ),
          )
          .where(eq(serviceCategories.enabled, true))
          .orderBy(asc(serviceCategories.displayOrder)),
        db
          .select({
            id: audienceCategories.id,
            code: audienceCategories.code,
            label: audienceCategoryTranslations.label,
          })
          .from(audienceCategories)
          .leftJoin(
            audienceCategoryTranslations,
            and(
              eq(
                audienceCategoryTranslations.audienceCategoryId,
                audienceCategories.id,
              ),
              eq(audienceCategoryTranslations.languageCode, locale),
            ),
          )
          .where(eq(audienceCategories.enabled, true))
          .orderBy(asc(audienceCategories.displayOrder)),
        db
          .select({
            id: tags.id,
            code: tags.code,
            namespace: tags.namespace,
            label: tagTranslations.label,
          })
          .from(tags)
          .leftJoin(
            tagTranslations,
            and(
              eq(tagTranslations.tagId, tags.id),
              eq(tagTranslations.languageCode, locale),
            ),
          )
          .where(
            and(
              eq(tags.active, true),
              eq(tags.visibility, "public"),
              selected.organizationId
                ? or(
                    isNull(tags.organizationId),
                    eq(tags.organizationId, selected.organizationId),
                  )
                : isNull(tags.organizationId),
            ),
          )
          .orderBy(asc(tags.displayOrder), asc(tags.code)),
        db
          .select({ tagId: activityTags.tagId })
          .from(activityTags)
          .where(eq(activityTags.activityId, selected.id))
          .orderBy(asc(activityTags.displayOrder)),
        db
          .select({
            assetId: activityAssets.assetId,
            storageKey: assets.storageKey,
            altText: assetTranslations.altText,
          })
          .from(activityAssets)
          .innerJoin(assets, eq(assets.id, activityAssets.assetId))
          .leftJoin(
            assetTranslations,
            and(
              eq(assetTranslations.assetId, activityAssets.assetId),
              eq(assetTranslations.languageCode, selected.sourceLanguageCode),
            ),
          )
          .where(
            and(
              eq(activityAssets.activityId, selected.id),
              eq(activityAssets.role, "cover"),
              eq(activityAssets.active, true),
            ),
          )
          .limit(1),
        db
          .select({
            id: downloads.id,
            title: downloadTranslations.title,
          })
          .from(activityAssets)
          .innerJoin(downloads, eq(downloads.assetId, activityAssets.assetId))
          .leftJoin(
            downloadTranslations,
            and(
              eq(downloadTranslations.downloadId, downloads.id),
              eq(
                downloadTranslations.languageCode,
                selected.sourceLanguageCode,
              ),
            ),
          )
          .where(
            and(
              eq(activityAssets.activityId, selected.id),
              eq(activityAssets.role, "attachment"),
            ),
          )
          .orderBy(asc(activityAssets.displayOrder)),
      ])
    : [[], [], [], [], [], [], []];

  const verifierIds = [
    ...new Set(
      initialTranslationRows.flatMap((row) =>
        row.verifiedById ? [row.verifiedById] : [],
      ),
    ),
  ];
  const verifierRows = verifierIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, verifierIds))
    : [];
  const verifierById = new Map(verifierRows.map((row) => [row.id, row]));

  const assignmentByLanguage = new Map<
    string,
    (typeof assignmentRows)[number]
  >();
  for (const assignment of assignmentRows) {
    if (!assignmentByLanguage.has(assignment.languageCode)) {
      assignmentByLanguage.set(assignment.languageCode, assignment);
    }
  }
  const translationByLanguage = new Map<
    string,
    (typeof initialTranslationRows)[number]
  >();
  for (const row of initialTranslationRows) {
    translationByLanguage.set(row.languageCode, row);
  }
  const now2 = new Date();
  const languageStatuses = editorialLanguageCodes.map((code) => {
    const translation = translationByLanguage.get(code);
    const assignment = assignmentByLanguage.get(code);
    const publication = publicationRows.find(
      (row) => row.activityId === selected?.id && row.languageCode === code,
    );
    const scheduled = Boolean(
      publication?.scheduledFor && publication.scheduledFor > publicationNow,
    );
    return {
      code,
      name: translation?.name ?? null,
      state: translation?.state ?? "draft",
      method: translation?.method ?? "human",
      publishedAt:
        publication && !scheduled
          ? localePublicationDateTime(
              publication.scheduledFor ?? publication.publishedAt,
              locale,
            )
          : null,
      scheduledFor:
        publication?.scheduledFor && scheduled
          ? localePublicationDateTime(publication.scheduledFor, locale)
          : null,
      verifiedBy: translation?.verifiedById
        ? (verifierById.get(translation.verifiedById) ?? null)
        : null,
      assignment: assignment
        ? {
            id: assignment.id,
            state:
              assignment.expiresAt <= now2 &&
              !["accepted", "rejected", "published"].includes(assignment.state)
                ? "expired"
                : assignment.state,
            translatorEmail: assignment.translatorEmail,
            translatorName: assignment.translatorName,
            expiresAt: new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(assignment.expiresAt),
            submittedContent: assignment.submittedContent,
            reviewNote: assignment.reviewNote,
          }
        : null,
    };
  });

  const categoryOptions = categoryOptionRows.map((row) => ({
    value: row.id,
    label: row.label ?? row.code,
  }));
  const audienceOptions = audienceOptionRows.map((row) => ({
    value: row.id,
    label: row.label ?? row.code,
  }));
  const availableTagIds = new Set(tagOptionRows.map((row) => row.id));
  const tagOptions = tagOptionRows.map((row) => ({
    value: row.id,
    label: row.label ?? row.code,
    description: row.namespace,
  }));
  const currentTagIds = currentTagRows
    .map((row) => row.tagId)
    .filter((id) => availableTagIds.has(id));
  const coverMedia = coverRows[0]
    ? {
        assetId: coverRows[0].assetId,
        previewUrl: await createAssetReadUrl(coverRows[0].storageKey),
        altText: coverRows[0].altText ?? t["media.coverAttached"],
      }
    : null;
  const downloadMedia = downloadRows.map((row) => ({
    id: row.id,
    title: row.title ?? t["service.untitled"],
  }));

  const serviceNames = new Map<string, typeof serviceCatalogTranslations>();
  for (const row of serviceCatalogTranslations) {
    const current = serviceNames.get(row.serviceId) ?? [];
    current.push(row);
    serviceNames.set(row.serviceId, current);
  }
  const managedServices = serviceCatalogRows.map((service) => {
    const translations = serviceNames.get(service.id) ?? [];
    const names: Partial<Record<"fr" | "en" | "ar", string>> = {};
    const descriptions: Partial<Record<"fr" | "en" | "ar", string>> = {};
    for (const translation of translations) {
      if (
        translation.languageCode === "fr" ||
        translation.languageCode === "en" ||
        translation.languageCode === "ar"
      ) {
        names[translation.languageCode] = translation.name;
        if (translation.description) {
          descriptions[translation.languageCode] = translation.description;
        }
      }
    }
    return {
      id: service.id,
      organizationId: service.organizationId,
      categoryId: service.categoryId,
      category: service.categoryLabel ?? service.categoryCode,
      icon: service.icon,
      active: service.active,
      archived: service.archivedAt !== null,
      sourceNote: service.sourceNote,
      names,
      descriptions,
      displayName:
        names[locale] ??
        names.fr ??
        names.en ??
        names.ar ??
        t["service.untitled"],
    };
  });
  return (
    <WorkspacePage>
      {!selected ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t["activities.title"]}
            </h1>
            <p className="text-copy-muted mt-2 max-w-3xl text-sm">
              {t["activities.sub"]}
            </p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href={localizedPath("/dashboard/activities/new", locale)} />
            }
          >
            <Plus aria-hidden />
            {t["activity.create.action"]}
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm">
            {t["empty.activities"]}
          </CardContent>
        </Card>
      ) : !selected ? (
        <section className="grid gap-5">
          <dl className="border-line bg-surface grid overflow-hidden rounded-xl border sm:grid-cols-3">
            {[
              [t["list.total"], list.length],
              [t["list.published"], publishedCount],
              [t["list.attention"], attentionCount],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-line grid gap-1 border-b px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0"
              >
                <dt className="text-copy-muted text-xs font-medium">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <form
            action={localizedPath("/dashboard/activities", locale)}
            method="get"
            className="border-line bg-surface grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]"
          >
            <Input
              type="search"
              name="q"
              defaultValue={search.q ?? ""}
              placeholder={t["list.searchPlaceholder"]}
              aria-label={t["list.searchPlaceholder"]}
            />
            <SelectField
              name="status"
              defaultValue={requestedStatus}
              aria-label={t["list.filterState"]}
            >
              <option value="">{t["list.allStates"]}</option>
              {activityStates.map((state) => (
                <option key={state} value={state}>
                  {t[`state.${state}`]}
                </option>
              ))}
            </SelectField>
            <Button type="submit">
              <Search aria-hidden />
              {t["list.applyFilters"]}
            </Button>
          </form>

          <div className="border-line bg-surface overflow-hidden rounded-xl border">
            <div className="border-line bg-subtle text-copy-muted hidden grid-cols-[minmax(16rem,2fr)_minmax(9rem,1fr)_8rem_minmax(10rem,1fr)_9rem_2rem] gap-4 border-b px-5 py-3 text-xs font-medium md:grid">
              <span>{t["list.nameColumn"]}</span>
              <span>{t["list.ownerColumn"]}</span>
              <span>{t["list.statusColumn"]}</span>
              <span>{t["list.languagesColumn"]}</span>
              <span>{t["list.updatedColumn"]}</span>
              <span aria-hidden />
            </div>
            {filtered.length > 0 ? (
              <nav
                aria-label={t["activities.title"]}
                className="divide-line divide-y"
              >
                {filtered.map((activity) => (
                  <Link
                    key={activity.id}
                    href={`${localizedPath("/dashboard/activities", locale)}?activity=${activity.id}`}
                    aria-label={t["list.open"].replace(
                      "{title}",
                      activity.title,
                    )}
                    className="hover:bg-subtle focus-visible:ring-ring grid gap-4 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset md:grid-cols-[minmax(16rem,2fr)_minmax(9rem,1fr)_8rem_minmax(10rem,1fr)_9rem_2rem] md:items-center"
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-semibold">
                        {activity.title}
                      </span>
                      <span className="text-copy-muted mt-1 block truncate text-xs">
                        {activity.scopeLabel}
                        {activity.teamName
                          ? ` · ${t["activity.cityTeam"]}: ${activity.teamName}`
                          : ""}
                      </span>
                    </div>
                    <p className="text-copy-muted min-w-0 truncate text-sm">
                      <span className="mb-1 block text-xs font-medium md:hidden">
                        {t["list.ownerColumn"]}
                      </span>
                      {activity.organization}
                    </p>
                    <div>
                      <span className="text-copy-muted mb-1 block text-xs font-medium md:hidden">
                        {t["list.statusColumn"]}
                      </span>
                      <Badge variant={stateBadge[activity.state]}>
                        {t[`state.${activity.state}`]}
                      </Badge>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      <span className="text-copy-muted mb-0.5 block w-full text-xs font-medium md:hidden">
                        {t["list.languagesColumn"]}
                      </span>
                      {activity.publishedLanguages.length > 0
                        ? activity.publishedLanguages.map((language) => (
                            <span
                              key={language}
                              className="border-line text-copy-muted rounded border px-1.5 py-0.5 text-[0.7rem] font-medium"
                            >
                              {t[`language.${language}` as keyof typeof t]}
                            </span>
                          ))
                        : "—"}
                    </div>
                    <time
                      dateTime={activity.updatedAt.toISOString()}
                      className="text-copy-muted text-sm tabular-nums"
                    >
                      <span className="mb-1 block text-xs font-medium md:hidden">
                        {t["list.updatedColumn"]}
                      </span>
                      {localeDate(activity.updatedAt, locale)}
                    </time>
                    <ArrowRight
                      className="text-copy-muted hidden size-4 md:block"
                      aria-hidden
                    />
                  </Link>
                ))}
              </nav>
            ) : (
              <p className="text-copy-muted px-5 py-12 text-center text-sm">
                {t["list.noResults"]}
              </p>
            )}
          </div>
        </section>
      ) : (
        <div className="min-w-0 space-y-5">
          <Button
            variant="ghost"
            nativeButton={false}
            render={
              <Link href={localizedPath("/dashboard/activities", locale)} />
            }
          >
            <ArrowLeft aria-hidden />
            {t["activity.create.back"]}
          </Button>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid min-w-0 gap-5 xl:col-start-1 xl:row-start-1">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-xl">
                        {selected.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {selected.organization} · {selected.scopeLabel}
                      </CardDescription>
                    </div>
                    <Badge variant={stateBadge[selected.state]}>
                      {t[`state.${selected.state}`]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="text-copy-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span>
                      {t["overview.owner"]}:{" "}
                      <span className="text-ink font-medium">
                        {selected.organization}
                      </span>
                    </span>
                    <span>
                      {t["overview.sourceLanguage"]}:{" "}
                      <span className="text-ink font-medium">
                        {
                          t[
                            `language.${selected.sourceLanguageCode}` as keyof typeof t
                          ]
                        }
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden />
                      {selected.scopeLabel}
                      {selected.teamName
                        ? ` · ${t["activity.cityTeam"]}: ${selected.teamName}`
                        : ""}
                    </span>
                  </div>
                  {selected.reviewDue ? (
                    <div className="border-warn/50 bg-warn-soft text-warn flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
                      <TriangleAlert className="size-4 shrink-0" aria-hidden />
                      {t["freshness.warning"]}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t["detail.content"]}
                  </CardTitle>
                  <CardDescription>{t["detail.contentHint"]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityEditorForm
                    key={selected.id}
                    locale={locale}
                    activityId={selected.id}
                    organizationId={selected.organizationId}
                    sourceLanguage={
                      selected.sourceLanguageCode as EditorialLanguage
                    }
                    initial={initialContent}
                    canVerify={canVerifyTranslations}
                    returnPath={`/${locale}/dashboard/activities?activity=${selected.id}`}
                    categories={categoryOptions}
                    audiences={audienceOptions}
                    tags={tagOptions}
                    initialCategoryId={selected.categoryId}
                    initialAudienceId={selected.audienceCategoryId}
                    initialTagIds={currentTagIds}
                    editorLabels={editorLabels}
                    labels={{
                      save: t["editor.save"],
                      saved: t["editor.saved"],
                      saveError: t["editor.saveError"],
                      category: t["table.category"],
                      audience: t["table.audience"],
                      tags: t["activity.create.tags"],
                      tagsHint: t["editor.tagsHint"],
                      tagsEmpty: t["editor.tagsEmpty"],
                      tagsPlaceholder: t["activity.create.chooseTags"],
                      noMatch: t["activity.create.noMatch"],
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t["activity.services"]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityServiceManager
                    key={selected.id}
                    activityId={selected.id}
                    organizationId={selected.organizationId}
                    locale={locale}
                    assignedIds={[
                      ...new Set(assignedServices.map((service) => service.id)),
                    ]}
                    services={managedServices}
                    categories={categoryRows.map((category) => ({
                      value: category.id,
                      label: category.label ?? category.code,
                      icon: category.icon,
                    }))}
                    labels={{
                      assignment: t["serviceManager.assignment"],
                      assignmentPlaceholder:
                        t["serviceManager.assignmentPlaceholder"],
                      empty: t["serviceManager.empty"],
                      saveAssignment: t["serviceManager.saveAssignment"],
                      assignmentSaved: t["serviceManager.assignmentSaved"],
                      assignmentSaveError:
                        t["serviceManager.assignmentSaveError"],
                      catalogue: t["serviceManager.catalogue"],
                      catalogueHint: t["serviceManager.catalogueHint"],
                      catalogueEmpty: t["serviceManager.catalogueEmpty"],
                      create: t["serviceManager.create"],
                      createTitle: t["serviceManager.createTitle"],
                      createHint: t["serviceManager.createHint"],
                      createAndAssign: t["serviceManager.createAndAssign"],
                      edit: t["serviceManager.edit"],
                      editTitle: t["serviceManager.editTitle"],
                      editHint: t["serviceManager.editHint"],
                      save: t["serviceManager.save"],
                      archive: t["serviceManager.archive"],
                      archiveTitle: t["serviceManager.archiveTitle"],
                      archiveHint: t["serviceManager.archiveHint"],
                      archiveConfirm: t["serviceManager.archiveConfirm"],
                      archived: t["serviceManager.archived"],
                      restore: t["serviceManager.restore"],
                      cancel: t["serviceManager.cancel"],
                      category: t["serviceManager.category"],
                      categoryPlaceholder:
                        t["serviceManager.categoryPlaceholder"],
                      noOptions: t["serviceManager.noOptions"],
                      "name.fr": t["serviceManager.nameFr"],
                      "name.en": t["serviceManager.nameEn"],
                      "name.ar": t["serviceManager.nameAr"],
                      "description.fr": t["serviceManager.descriptionFr"],
                      "description.en": t["serviceManager.descriptionEn"],
                      "description.ar": t["serviceManager.descriptionAr"],
                      sourceNote: t["serviceManager.sourceNote"],
                      sourceHint: t["serviceManager.sourceHint"],
                      icon: t["serviceManager.icon"],
                      iconHint: t["serviceManager.iconHint"],
                      scope: t["serviceManager.scope"],
                      scopeGlobal: t["scope.global"],
                      scopeOrganization: t["scope.organization"],
                    }}
                    canManageGlobal={canManageGlobal}
                    showCatalogue={false}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="size-4" aria-hidden />
                    {t["activity.schedule"]}
                  </CardTitle>
                  <CardDescription>
                    {t["activity.scheduleHint"]}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <ActivityScheduleRules
                    activityId={selected.id}
                    locale={locale}
                    rules={scheduleRows}
                    labels={{
                      empty: t["activity.scheduleEmpty"],
                      remove: t["activity.scheduleRemove"],
                      confirmTitle: t["activity.scheduleRemoveTitle"],
                      confirmDescription:
                        t["activity.scheduleRemoveDescription"],
                      confirm: t["activity.scheduleRemoveConfirm"],
                      cancel: t["activity.scheduleRemoveCancel"],
                      weekdays: Object.fromEntries(
                        weekdays.map((weekday) => [
                          weekday,
                          t[`weekday.${String(weekday)}` as keyof typeof t],
                        ]),
                      ),
                      oneOff: t["activity.create.oneOff"],
                      recurring: t["activity.create.recurring"],
                      fixed: t["activity.create.fixedTime"],
                      flexible: t["activity.create.flexibleTime"],
                    }}
                  />
                  <ActivityScheduleForm
                    key={selected.id}
                    activityId={selected.id}
                    locale={locale}
                    schedules={scheduleRows}
                    labels={{
                      scheduleType: t["activity.create.scheduleType"],
                      recurring: t["activity.create.recurring"],
                      oneOff: t["activity.create.oneOff"],
                      date: t["activity.create.date"],
                      selectDate: t["activity.create.selectDate"],
                      clearDate: t["activity.create.clearDate"],
                      timingMode: t["activity.create.timingMode"],
                      fixed: t["activity.create.fixedTime"],
                      flexible: t["activity.create.flexibleTime"],
                      weekday: t["activity.weekday"],
                      startTime: t["activity.startTime"],
                      endTime: t["activity.endTime"],
                      addHours: t["activity.addHours"],
                      cancel: t["activity.scheduleRemoveCancel"],
                      invalidRange: t["activity.scheduleInvalidRange"],
                      overlap: t["activity.scheduleOverlap"],
                      invalid: t["activity.scheduleInvalid"],
                      weekdays: Object.fromEntries(
                        weekdays.map((weekday) => [
                          weekday,
                          t[`weekday.${String(weekday)}` as keyof typeof t],
                        ]),
                      ),
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 xl:col-start-2 xl:row-start-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t["publication.heading"]}
                  </CardTitle>
                  <CardDescription>
                    {t["detail.translationsHint"]}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pe-2">
                  <ScrollArea
                    className="h-[34rem] pe-3"
                    aria-label={t["publication.heading"]}
                  >
                    <ActivityTranslationPanel
                      key={selected.id}
                      locale={locale}
                      activityId={selected.id}
                      sourceLanguage={
                        selected.sourceLanguageCode as EditorialLanguage
                      }
                      sourceWordCount={sourceWordCount}
                      languages={languageStatuses}
                      labels={{ ...translationLabels, ...t }}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t["media.title"]}
                  </CardTitle>
                  <CardDescription>{t["media.hint"]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityMediaManager
                    key={`${selected.id}-${coverMedia?.assetId ?? "none"}`}
                    locale={locale}
                    activityId={selected.id}
                    sourceLanguage={
                      selected.sourceLanguageCode as EditorialLanguage
                    }
                    cover={coverMedia}
                    downloads={downloadMedia}
                    labels={{
                      coverHeading: t["media.coverHeading"],
                      coverHint: t["media.coverHint"],
                      coverAttached: t["media.coverAttached"],
                      altLabel: t["media.altLabel"],
                      rights: t["media.rights"],
                      select: t["media.select"],
                      replace: t["media.replace"],
                      remove: t["media.remove"],
                      uploading: t["media.uploading"],
                      uploadError: t["media.uploadError"],
                      coverSaved: t["media.coverSaved"],
                      coverRemoved: t["media.coverRemoved"],
                      downloadsHeading: t["media.downloadsHeading"],
                      downloadsHint: t["media.downloadsHint"],
                      downloadsEmpty: t["media.downloadsEmpty"],
                      downloadTitle: t["media.downloadTitle"],
                      addDownload: t["media.addDownload"],
                      downloadAdded: t["media.downloadAdded"],
                      downloadRemoved: t["media.downloadRemoved"],
                      removeError: t["media.removeError"],
                      constraints: t["media.constraints"],
                    }}
                  />
                </CardContent>
              </Card>

              {/* Who to ask when this activity turns out to be wrong. Saved on
               * its own, so recording a phone number never means re-submitting
               * the whole record. */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t["steward.title"]}
                  </CardTitle>
                  <CardDescription>{t["steward.hint"]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <StewardContactForm
                    key={selected.id}
                    action={updateActivitySteward}
                    locale={locale}
                    recordId={selected.id}
                    values={selected}
                    labels={t}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </WorkspacePage>
  );
}
