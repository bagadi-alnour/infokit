import { isPublicLocale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileImage,
  MapPin,
  Plus,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import {
  ActivitiesTable,
  type ActivitiesTableLabels,
  type ActivityTableRow,
} from "~/components/admin/activities-table";
import { confirmActivityFreshness } from "~/app/[locale]/dashboard/activities/actions";
import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import { ActivityDetailsForm } from "~/components/admin/activity-classification";
import { ActivityEditorForm } from "~/components/admin/activity-content-form";
import {
  ActivityCoverManager,
  ActivityDownloadsManager,
} from "~/components/admin/activity-media-manager";
import { ActivityLocationForm } from "~/components/admin/activity-location-form";
import { ActivityScheduleForm } from "~/components/admin/activity-schedule-form";
import { ActivityScheduleRules } from "~/components/admin/activity-schedule-rules";
import {
  ACTIVITY_STATES,
  type ActivityStateValue,
} from "~/components/admin/content-states";
import { StewardContactForm } from "~/components/admin/steward-contact-form";
import { PendingButton } from "~/components/pending-button";
import { TransitLinkFields } from "~/components/admin/transit-links";
import type { WorkspaceTranslation } from "~/components/admin/translation-workspace";
import {
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  editorialLanguageCodes,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import { translationRequestLive } from "~/lib/translation-request";
import { buildWorkspaceLabels } from "~/lib/workspace-labels";
import { zonedDateKey } from "~/lib/zoned-time";
import { hasAiTranslationProvider } from "~/server/ai/provider";
import { createAssetReadUrl } from "~/server/assets/s3";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import {
  activityWorkspacePermissions,
  hasActualPlatformPermission,
  ownedWithin,
  permissionScopeAny,
} from "~/server/auth/authorization";
import { denyPageAccess, hasPermission } from "~/server/auth/require";
import { platformVerifyPermission } from "~/server/content/language-review";
import { loadStewardCandidates } from "~/server/content/steward-candidates";
import {
  activities,
  activityAssets,
  activityPublications,
  activityServices,
  activityTags,
  activityTransitLinks,
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
  placeTranslations,
  places,
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

type ActivityState = ActivityStateValue;

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
  searchParams: Promise<{ activity?: string }>;
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

  // What this reader administers. An association's editor manages its own
  // activities; the list is where that stops being a claim about the buttons and
  // starts being a claim about the rows, since anything listed here is one click
  // from its steward's name and mobile number.
  const scope =
    (session?.user.id
      ? await permissionScopeAny(session.user.id, activityWorkspacePermissions)
      : null) ??
    (await denyPageAccess(activityWorkspacePermissions[0], locale));

  // The editor, its language accordion and every dialog those open speak one
  // vocabulary: the create catalogue, filled from this page's own words.
  const editorLabels = buildWorkspaceLabels(
    overviewLabels,
    t,
    translationLabels,
  );

  // ---- Activity list ----------------------------------------------------
  const activityRows = await db
    .select({
      id: activities.id,
      // The public URL key: the row menu can only offer the public page to an
      // activity that has one.
      slug: activities.slug,
      organizationId: activities.organizationId,
      cityId: activities.cityId,
      teamId: activities.teamId,
      // Where it happens today, so the editor's location card opens on it.
      placeId: activities.placeId,
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
      // Who entered it. The organisation answers for the activity; this is the
      // person to ask what they meant.
      createdByName: users.name,
      // Who may operate on it from the list: the person who entered it answers
      // for it. Compared on the server; the browser is told the answer, not the
      // identity it was derived from.
      createdById: activities.createdById,
    })
    .from(activities)
    // Every join is outer, because every one of these is optional: an activity
    // the platform holds has no organisation, and a global activity belongs to
    // no city and therefore to no city team. An inner join would not filter
    // those rows, it would hide them.
    .leftJoin(organizations, eq(activities.organizationId, organizations.id))
    .leftJoin(cities, eq(activities.cityId, cities.id))
    .leftJoin(cityTeams, eq(activities.teamId, cityTeams.id))
    .leftJoin(
      cityTranslations,
      and(
        eq(cityTranslations.cityId, cities.id),
        eq(cityTranslations.languageCode, locale),
      ),
    )
    .leftJoin(users, eq(users.id, activities.createdById))
    .where(
      and(
        isNull(activities.archivedAt),
        ownedWithin(activities.organizationId, scope),
      ),
    )
    .orderBy(asc(organizations.displayName), asc(cities.code));
  /**
   * An activity with no organisation is one the platform holds itself, so the
   * owner column names the platform rather than leaving the cell empty.
   */
  const rows = activityRows.map((activity) => ({
    ...activity,
    organization: activity.organization ?? t["activity.platformOwner"],
  }));
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

  /**
   * The days an activity opens, for the list. Only rules that apply today count:
   * a season that has ended, or one that has not started, is not an opening day
   * — and a column that says otherwise sends someone to a closed door.
   */
  const todayKey = zonedDateKey(now, "Europe/Paris");
  const scheduleDayRows = ids.length
    ? await db
        .select({
          activityId: scheduleRules.activityId,
          weekday: scheduleRules.weekday,
        })
        .from(scheduleRules)
        .where(
          and(
            inArray(scheduleRules.activityId, ids),
            or(
              isNull(scheduleRules.validFrom),
              lte(scheduleRules.validFrom, todayKey),
            ),
            or(
              isNull(scheduleRules.validTo),
              gte(scheduleRules.validTo, todayKey),
            ),
          ),
        )
    : [];
  const openWeekdaysById = new Map<string, Set<number>>();
  for (const row of scheduleDayRows) {
    const days = openWeekdaysById.get(row.activityId) ?? new Set<number>();
    days.add(row.weekday);
    openWeekdaysById.set(row.activityId, days);
  }

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
    /** Monday first, always in the week's order rather than the rules'. */
    openWeekdays: weekdays.filter((weekday) =>
      openWeekdaysById.get(row.id)?.has(weekday),
    ),
    /** A language waiting for its publication date still counts as spoken for. */
    scheduledLanguages: scheduledLanguagesById.get(row.id) ?? [],
    reviewDue: row.reviewDueAt !== null && row.reviewDueAt <= now,
  }));

  const publishedCount = list.filter(
    (activity) => activity.state === "published",
  ).length;
  const attentionCount = list.filter(
    (activity) => activity.state !== "published" || activity.reviewDue,
  ).length;

  /**
   * The public page of an activity, when it has one: a slug, and a language
   * that is live. The workspace language comes first — it is the one the editor
   * is reading — and any other published language will do. Every editorial
   * language is a public locale, so a published language always resolves.
   */
  const publicActivityHref = (slug: string | null, languages: string[]) => {
    if (!slug) return null;
    const language = languages.includes(locale)
      ? locale
      : languages.find(isPublicLocale);
    return language ? localizedPath(`/activities/${slug}`, language) : null;
  };

  /**
   * Who may change an activity from the list: the person who entered it, and a
   * platform administrator — who has to be able to finish what someone who has
   * left started, and is the only editor a seeded activity has. Everyone else
   * reads it.
   */
  const viewerId = session?.user.id ?? null;
  const mayEdit = (createdById: string | null) =>
    canManageGlobal || (viewerId !== null && createdById === viewerId);

  const tableRows: ActivityTableRow[] = list.map((activity) => {
    const canEdit = mayEdit(activity.createdById);
    return {
      id: activity.id,
      href: localizedPath("/dashboard/activities", locale, {
        activity: activity.id,
      }),
      title: activity.title,
      scopeLabel: activity.scopeLabel,
      teamName: activity.teamName,
      owner: activity.organization,
      createdBy: activity.createdByName,
      state: activity.state,
      publishedLanguages: activity.publishedLanguages,
      openDays: activity.openWeekdays.map(
        (weekday) => t[`weekday.${String(weekday)}` as keyof typeof t],
      ),
      updatedAtIso: activity.updatedAt.toISOString(),
      updatedLabel: localeDate(activity.updatedAt, locale),
      reviewDue: activity.reviewDue,
      publicHref: publicActivityHref(
        activity.slug,
        activity.publishedLanguages,
      ),
      canEdit,
      // Publishing is a promise to the public: an activity keeps that promise
      // until someone takes each language down, and only then can it go. A
      // language waiting for its date is a promise too.
      canDelete:
        canEdit &&
        activity.publishedLanguages.length === 0 &&
        activity.scheduledLanguages.length === 0,
    };
  });

  const tableLabels: ActivitiesTableLabels = {
    search: t["console.search"],
    searchPlaceholder: t["list.searchPlaceholder"],
    columns: t["table.columns"],
    clear: t["table.clearSearch"],
    filterBy: t["table.filterBy"],
    noMatch: t["list.noResults"],
    rowsPerPage: t["table.rowsPerPage"],
    results: t["table.results"],
    page: t["table.page"],
    previous: t["table.previousPage"],
    next: t["table.nextPage"],
    activity: t["list.nameColumn"],
    owner: t["list.ownerColumn"],
    createdBy: t["list.createdByColumn"],
    status: t["list.statusColumn"],
    languages: t["list.languagesColumn"],
    openDays: t["list.openDaysColumn"],
    updated: t["list.updatedColumn"],
    cityTeam: t["activity.cityTeam"],
    reviewDue: t["list.reviewDue"],
    // Punctuation, not wording: an empty cell reads as a missing value.
    none: "—",
    stateLabels: Object.fromEntries(
      ACTIVITY_STATES.map((state) => [state, t[`state.${state}`]]),
    ) as Record<ActivityStateValue, string>,
    languageLabels: Object.fromEntries(
      editorialLanguageCodes.map((code) => [code, t[`language.${code}`]]),
    ),
    dayLabels: weekdays.map(
      (weekday) => t[`weekday.${String(weekday)}` as keyof typeof t],
    ),
    actions: t["table.actions"],
    open: t["rowAction.open"],
    view: t["rowAction.view"],
    viewPublic: t["rowAction.viewPublic"],
    unpublish: t["rowAction.unpublish"],
    unpublishTitle: t["rowAction.unpublishTitle"],
    unpublishBody: t["rowAction.unpublishBody"],
    unpublishConfirm: t["rowAction.unpublishConfirm"],
    remove: t["rowAction.delete"],
    removeTitle: t["rowAction.deleteTitle"],
    removeBody: t["rowAction.deleteBody"],
    removeConfirm: t["rowAction.deleteConfirm"],
    removed: t["toast.deleted"],
    cancel: t.cancel,
    unpublished: t["toast.unpublished"],
    actionError: t["toast.actionError"],
  };

  const selected = search.activity
    ? list.find((row) => row.id === search.activity)
    : undefined;
  /**
   * Who the platform can already name for the contact card: the custodian
   * organisation's roster, and whoever entered the activity — the only
   * candidate there is on one the platform holds itself.
   */
  const stewardCandidates = await loadStewardCandidates({
    organizationId: selected?.organizationId,
    authorId: selected?.createdById,
  });

  // ---- Selected activity detail ----------------------------------------
  const [
    initialTranslationRows,
    assignedServices,
    scheduleRows,
    transitRows,
    serviceCatalogRows,
    serviceCatalogTranslations,
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
            reviewStage: activityTranslations.reviewStage,
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
        // How to get here without a car, in the order the editor put the rows
        // in; the insertion time only breaks a tie between two rows saved at
        // position zero, which nothing in the form can produce.
        db
          .select({
            mode: activityTransitLinks.mode,
            line: activityTransitLinks.line,
            stopName: activityTransitLinks.stopName,
            walkMinutes: activityTransitLinks.walkMinutes,
          })
          .from(activityTransitLinks)
          .where(eq(activityTransitLinks.activityId, selected.id))
          .orderBy(
            asc(activityTransitLinks.displayOrder),
            asc(activityTransitLinks.createdAt),
          ),
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
            // A platform-held activity draws on the shared catalogue alone: the
            // services an organisation owns are not the platform's to attach.
            selected.organizationId
              ? or(
                  isNull(services.organizationId),
                  eq(services.organizationId, selected.organizationId),
                )
              : isNull(services.organizationId),
          )
          .orderBy(asc(serviceCategories.displayOrder)),
        db.select().from(serviceTranslations),
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
  // A platform-held activity is checked platform-wide: there is no organisation
  // whose members could hold the permission for it.
  const canVerifyTranslations = selected
    ? await hasPermission(
        "content.translation.verify",
        selected.organizationId ?? undefined,
      )
    : false;

  // ---- Classification, translator, and media (selected activity only) --
  // The word count a translator is quoted comes from the source pane as it
  // stands, so the workspace counts it in the browser rather than here.
  const [
    assignmentRows,
    categoryOptionRows,
    audienceOptionRows,
    tagOptionRows,
    currentTagRows,
    coverRows,
    downloadRows,
    cityOptionRows,
    placeOptionRows,
  ] = selected
    ? await Promise.all([
        db
          .select({
            id: translationAssignments.id,
            languageCode: translationAssignments.targetLanguageCode,
            state: translationAssignments.state,
            translatorEmail: translationAssignments.translatorEmail,
            translatorName: translationAssignments.translatorName,
            requestedAt: translationAssignments.createdAt,
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
            mimeType: assets.mimeType,
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
        // Every city and every place the activity could be moved to. A place
        // belongs to one city, so the browser narrows the second list from the
        // first rather than asking the server again on each change.
        db
          .select({
            id: cities.id,
            code: cities.code,
            name: cityTranslations.name,
          })
          .from(cities)
          .leftJoin(
            cityTranslations,
            and(
              eq(cityTranslations.cityId, cities.id),
              eq(cityTranslations.languageCode, locale),
            ),
          )
          .orderBy(asc(cities.code)),
        db
          .select({
            id: places.id,
            cityId: places.cityId,
            addressLine: places.addressLine,
            name: placeTranslations.name,
          })
          .from(places)
          .leftJoin(
            placeTranslations,
            and(
              eq(placeTranslations.placeId, places.id),
              eq(placeTranslations.languageCode, locale),
            ),
          )
          .where(and(eq(places.active, true), isNull(places.archivedAt)))
          .orderBy(asc(placeTranslations.name)),
      ])
    : [[], [], [], [], [], [], [], [], []];

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
      reviewStage: translation?.reviewStage ?? "none",
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
            requestedAt: new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(assignment.requestedAt),
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

  /**
   * What each language's own menu offers. Every item is re-checked by the action
   * behind it; this only decides what is worth showing.
   *
   * Clearing a language for the public is asked platform-wide, with no
   * organisation named — the same call `decideLanguageReview` makes, so an
   * association's own verifier is not shown a decision the platform reserves.
   */
  const languageAbilities = selected
    ? {
        canPublish: await hasPermission(
          "content.activity.manage",
          selected.organizationId ?? undefined,
        ),
        canTeamValidate: await hasPermission(
          "content.activity.verify",
          selected.organizationId ?? undefined,
        ),
        canPlatformVerify: await hasPermission(platformVerifyPermission),
        canInvite: await hasPermission(
          "content.translation.request",
          selected.organizationId ?? undefined,
        ),
        // The record exists, so there is something to hand somebody.
        canGiveAccess: true,
      }
    : null;
  /** The same rows, keyed by language, as the accordion's menus read them. */
  const languageStates = Object.fromEntries(
    languageStatuses.map((language) => [
      language.code,
      {
        saved: Boolean(language.name),
        published: Boolean(language.publishedAt),
        scheduled: Boolean(language.scheduledFor),
        reviewStage: language.reviewStage,
        // A translator has sent words back that nobody has read yet. The state
        // above is already narrowed to "expired" when the link ran out, so a
        // stale submission does not ask to be countersigned.
        submitted: language.assignment?.state === "submitted",
        // An errand still with its translator: the menu names them and the day
        // they were asked instead of offering to ask a second person.
        translationRequest: translationRequestLive(language.assignment)
          ? {
              requestedAt: language.assignment?.requestedAt ?? "",
              translatorName: language.assignment?.translatorName ?? null,
              translatorEmail: language.assignment?.translatorEmail ?? "",
            }
          : null,
      },
    ]),
  );

  const categoryOptions = categoryOptionRows.map((row) => ({
    value: row.id,
    label: row.label ?? row.code,
  }));
  const audienceOptions = audienceOptionRows.map((row) => ({
    value: row.id,
    label: row.label ?? row.code,
  }));
  const cityOptions = cityOptionRows.map((row) => ({
    value: row.id,
    label: row.name ?? row.code,
  }));
  const placeOptions = placeOptionRows.map((row) => ({
    value: row.id,
    // A place with no name in this language is still findable by its address.
    label: row.name ?? row.addressLine ?? row.id,
    description: row.addressLine ?? undefined,
    cityId: row.cityId,
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
        previewUrl: await createAssetReadUrl(coverRows[0].storageKey, {
          contentType: coverRows[0].mimeType,
        }),
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
  // Adding an activity belongs to the list's own toolbar, beside the controls
  // that shape the list. The header keeps it only while there is no list yet —
  // the first activity has to be creatable from an empty page.
  const createActivity = (
    <Button
      nativeButton={false}
      render={
        <Link href={localizedPath("/dashboard/activities/new", locale)} />
      }
    >
      <Plus aria-hidden />
      {t["activity.create.action"]}
    </Button>
  );
  const activityFormId = selected ? `activity-content-${selected.id}` : "";

  return (
    <WorkspacePage>
      {!selected ? (
        <PageHeader
          family="activity"
          title={t["activities.title"]}
          sub={t["activities.sub"]}
          action={rows.length === 0 ? createActivity : null}
        />
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm">
            {t["empty.activities"]}
          </CardContent>
        </Card>
      ) : !selected ? (
        <>
          <StatGrid>
            <Stat label={t["list.total"]} value={list.length} />
            <Stat label={t["list.published"]} value={publishedCount} />
            <Stat label={t["list.attention"]} value={attentionCount} />
          </StatGrid>

          <ActivitiesTable
            rows={tableRows}
            locale={locale}
            labels={tableLabels}
            createAction={createActivity}
          />
        </>
      ) : languageAbilities ? (
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

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-xl">{selected.title}</CardTitle>
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
              {/* A warning with nothing to do about it says the same thing
               * again tomorrow, so the way to answer it sits inside it. */}
              {selected.reviewDue ? (
                <div className="border-warn/50 bg-warn-soft text-warn flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium">
                  <span className="flex min-w-0 items-center gap-2">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden />
                    {t["freshness.warning"]}
                  </span>
                  <ActionFeedbackForm
                    action={confirmActivityFreshness}
                    successMessage={t["freshness.confirmed"]}
                    errorMessage={t["toast.actionError"]}
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input
                      type="hidden"
                      name="activityId"
                      value={selected.id}
                    />
                    <PendingButton variant="secondary">
                      <CheckCircle2 aria-hidden />
                      {t["freshness.confirm"]}
                    </PendingButton>
                  </ActionFeedbackForm>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* The editing workspace spans the full width: source text and its
           * record fields stay on the left, while translations and media stay
           * on the right. */}
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">{t["detail.content"]}</CardTitle>
              <CardDescription>{t["detail.contentHint"]}</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityEditorForm
                key={selected.id}
                formId={activityFormId}
                locale={locale}
                activityId={selected.id}
                organizationId={selected.organizationId}
                sourceLanguage={
                  selected.sourceLanguageCode as EditorialLanguage
                }
                initial={initialContent}
                languageStates={languageStates}
                abilities={languageAbilities}
                aiEnabled={hasAiTranslationProvider()}
                // The list this came from excludes archived activities, so a
                // selected one is never frozen.
                archived={false}
                canVerify={canVerifyTranslations}
                returnPath={`/${locale}/dashboard/activities?activity=${selected.id}`}
                details={
                  <div className="@container mt-1 grid min-w-0 gap-4">
                    {/* Record-level controls follow the source text. Their
                     * fields point to the one Save action below the workspace.
                     *
                     * Two rows rather than one grid with a spanning cell: the
                     * classification cards are four one-line choices and pair
                     * up happily, while the editors below are tall and need the
                     * whole width to divide between them. */}
                    <div className="@xl:grid-cols-2 grid items-start gap-4">
                      <ActivityDetailsForm
                        key={selected.id}
                        formId={activityFormId}
                        categories={categoryOptions}
                        audiences={audienceOptions}
                        tags={tagOptions}
                        services={managedServices
                          .filter(
                            (service) => service.active && !service.archived,
                          )
                          .map((service) => ({
                            value: service.id,
                            label: service.displayName,
                            description: service.category,
                            icon: service.icon,
                          }))}
                        initialCategoryId={selected.categoryId}
                        initialAudienceId={selected.audienceCategoryId}
                        initialTagIds={currentTagIds}
                        initialServiceIds={[
                          ...new Set(
                            assignedServices.map((service) => service.id),
                          ),
                        ]}
                        labels={t}
                      />
                    </div>

                    <Card className="min-w-0">
                      <CardHeader>
                        <CardTitle className="text-base">
                          {t["activity.create.location"]}
                        </CardTitle>
                        <CardDescription>
                          {t["activity.create.locationHint"]}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ActivityLocationForm
                          key={selected.id}
                          formId={activityFormId}
                          cities={cityOptions}
                          places={placeOptions}
                          initial={{
                            scope: selected.cityId ? "city" : "global",
                            cityId: selected.cityId ?? "",
                            placeId: selected.placeId ?? "",
                            addressLine:
                              placeOptions.find(
                                (place) => place.value === selected.placeId,
                              )?.description ?? "",
                          }}
                          labels={t}
                        />
                      </CardContent>
                    </Card>

                    {/* The lower pair uses independent column stacks. That
                     * keeps the contact directly beneath Schedule even when
                     * the transport editor grows much taller. */}
                    {/* `@2xl`, not `@3xl`: this bundle only carries container
                     * variants some scanned source already uses, so a wider
                     * threshold would silently never split (see the
                     * `@source inline` note in styles/workspace.css). */}
                    <div className="@2xl:grid-cols-2 grid min-w-0 items-start gap-4">
                      <div className="grid min-w-0 content-start gap-4">
                        <Card className="min-w-0">
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
                                removed: t["activity.scheduleRemoved"],
                                error: t["toast.actionError"],
                                weekdays: Object.fromEntries(
                                  weekdays.map((weekday) => [
                                    weekday,
                                    t[
                                      `weekday.${String(weekday)}` as keyof typeof t
                                    ],
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
                                required: t["form.required"],
                                invalidRange:
                                  t["activity.scheduleInvalidRange"],
                                overlap: t["activity.scheduleOverlap"],
                                invalid: t["activity.scheduleInvalid"],
                                weekdays: Object.fromEntries(
                                  weekdays.map((weekday) => [
                                    weekday,
                                    t[
                                      `weekday.${String(weekday)}` as keyof typeof t
                                    ],
                                  ]),
                                ),
                              }}
                            />
                          </CardContent>
                        </Card>

                        <Card className="min-w-0">
                          <CardHeader>
                            <CardTitle className="text-base">
                              {t["steward.title"]}
                            </CardTitle>
                            <CardDescription>
                              {t["steward.hint"]}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <StewardContactForm
                              key={selected.id}
                              action={updateActivitySteward}
                              locale={locale}
                              recordId={selected.id}
                              values={selected}
                              members={stewardCandidates}
                              labels={t}
                              columns={false}
                              embedded
                              formId={activityFormId}
                            />
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="min-w-0">
                        <CardHeader>
                          <CardTitle className="text-base">
                            {t["transit.title"]}
                          </CardTitle>
                          <CardDescription>{t["transit.hint"]}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <TransitLinkFields
                            key={selected.id}
                            links={transitRows}
                            labels={t}
                            formId={activityFormId}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                }
                media={
                  <Card>
                    <CardHeader className="border-b">
                      {/* The documents are one button in the corner: this panel
                       * is the photo, and most activities have no PDF at all. */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileImage
                              className="size-4 shrink-0"
                              aria-hidden
                            />
                            {t["media.title"]}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {t["media.hint"]}
                          </CardDescription>
                        </div>
                        <ActivityDownloadsManager
                          key={selected.id}
                          locale={locale}
                          activityId={selected.id}
                          sourceLanguage={
                            selected.sourceLanguageCode as EditorialLanguage
                          }
                          downloads={downloadMedia}
                          labels={{
                            downloadsAction: t["media.downloadsAction"],
                            downloadsHeading: t["media.downloadsHeading"],
                            downloadsHint: t["media.downloadsHint"],
                            downloadsEmpty: t["media.downloadsEmpty"],
                            downloadTitle: t["media.downloadTitle"],
                            rights: t["media.rights"],
                            addDownload: t["media.addDownload"],
                            remove: t["media.remove"],
                            uploading: t["media.uploading"],
                            uploadError: t["media.uploadError"],
                            downloadAdded: t["media.downloadAdded"],
                            downloadRemoved: t["media.downloadRemoved"],
                            removeError: t["media.removeError"],
                            downloadConstraints: t["media.downloadConstraints"],
                          }}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ActivityCoverManager
                        key={`${selected.id}-${coverMedia?.assetId ?? "none"}`}
                        locale={locale}
                        activityId={selected.id}
                        sourceLanguage={
                          selected.sourceLanguageCode as EditorialLanguage
                        }
                        cover={coverMedia}
                        labels={{
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
                          removeError: t["media.removeError"],
                          constraints: t["media.constraints"],
                        }}
                      />
                    </CardContent>
                  </Card>
                }
                editorLabels={editorLabels}
                labels={{
                  save: t["console.save"],
                  saved: t["console.saved"],
                  saveError: t["form.saveFailed"],
                }}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </WorkspacePage>
  );
}
