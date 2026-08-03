import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  ArrowLeft,
  ListOrdered,
  Phone,
  Plus,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import {
  BasicInformationEditorForm,
  BasicInformationFreshnessForm,
  BasicInformationOrderForm,
  BasicInformationWorkflowBar,
  type BasicInformationLanguageStatus,
  type BasicInformationOptionRow,
} from "~/components/admin/basic-information-manage";
import {
  BasicsTable,
  type BasicInformationTableRow,
  type BasicsTableLabels,
} from "~/components/admin/basics-table";
import {
  ARTICLE_STATES,
  type ArticleStateValue,
} from "~/components/admin/content-states";
import {
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { HistoryTimeline } from "~/components/admin/history-timeline";
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
  basicInformationReviewIntervals,
  BASIC_INFORMATION_REVIEW_DAYS,
} from "~/lib/basic-information";
import {
  editorialLanguageCodes,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import { freshnessOf } from "~/lib/freshness";
import { buildWorkspaceLabels } from "~/lib/workspace-labels";
import { hasAiTranslationProvider } from "~/server/ai/provider";
import { auth } from "~/server/auth";
import {
  basicInformationWorkspacePermissions,
  ownedWithin,
  permissionScopeAny,
} from "~/server/auth/authorization";
import { denyPageAccess, hasPermission } from "~/server/auth/require";
import { platformVerifyPermission } from "~/server/content/language-review";
import { db } from "~/server/db";
import {
  basicInformationDetails,
  editorialCustodianships,
  editorialEntries,
  editorialPublications,
  editorialRevisions,
  editorialRevisionTranslations,
  organizations,
  serviceCategories,
  serviceCategoryTranslations,
  users,
} from "~/server/db/schema";

const contentLanguages = editorialLanguageCodes;
type ContentLanguage = EditorialLanguage;

/**
 * Who answers the phone, joined a second time. The list names two associations
 * per row and they are different questions — the custodian answers for the
 * number being right, the answerer picks it up — so the same table appears twice
 * under two names rather than being resolved in a second pass.
 */
const answeringOrganizations = alias(organizations, "answering_organizations");

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

const workflowBadge: Record<string, "default" | "secondary" | "outline"> = {
  published: "default",
  scheduled: "secondary",
  in_review: "secondary",
  unpublished: "outline",
  draft: "outline",
  archived: "outline",
};

/**
 * Which interval the freshness select should reopen on: the distance between the
 * last check and the next one, snapped to the nearest option offered. The
 * interval itself is not stored — only the two dates it produced — so this
 * recovers the editor's last choice instead of resetting everyone to a quarter.
 */
function intervalFrom(
  lastReviewedAt: Date | null,
  reviewDueAt: Date | null,
): number {
  if (!lastReviewedAt || !reviewDueAt) return BASIC_INFORMATION_REVIEW_DAYS;
  const days = Math.round(
    (reviewDueAt.getTime() - lastReviewedAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  let closest: number = BASIC_INFORMATION_REVIEW_DAYS;
  for (const option of basicInformationReviewIntervals) {
    if (Math.abs(option - days) < Math.abs(closest - days)) closest = option;
  }
  return closest;
}

export default async function BasicsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ entry?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const search = await searchParams;
  const [t, shared, overview] = await Promise.all([
    loadPageCatalog(locale, "dashboard-basics"),
    loadPageCatalog(locale, "dashboard-console"),
    // The editor and its language accordion speak one vocabulary everywhere.
    loadPageCatalog(locale, "dashboard-overview"),
  ]);
  const editorLabels = buildWorkspaceLabels(overview, t, shared);
  const session = await auth();
  const viewerId = session?.user.id ?? null;
  /**
   * What this reader administers. In practice these entries are the platform's
   * own — `platform_content_manager` is the only role carrying the two
   * basic-information grants (server/db/seed.ts) — but the scope is applied to
   * the custodianship exactly as on articles, so an association that is one day
   * handed a number of its own sees that one and no other.
   */
  const scope =
    (viewerId
      ? await permissionScopeAny(viewerId, basicInformationWorkspacePermissions)
      : null) ??
    (await denyPageAccess(basicInformationWorkspacePermissions[0], locale));

  // ---- The block, in the order readers meet it -------------------------
  const entryRows = await db
    .select({
      id: editorialEntries.id,
      slug: editorialEntries.slug,
      workflowState: editorialEntries.workflowState,
      archivedAt: editorialEntries.archivedAt,
      updatedAt: editorialEntries.updatedAt,
      icon: basicInformationDetails.icon,
      priority: basicInformationDetails.priority,
      emergency: basicInformationDetails.emergency,
      operator: basicInformationDetails.operator,
      categoryId: basicInformationDetails.categoryId,
      dial: basicInformationDetails.dial,
      reach: basicInformationDetails.reach,
      dialInstead: basicInformationDetails.dialInstead,
      answeredByOrganizationId:
        basicInformationDetails.answeredByOrganizationId,
      answeredByName: answeringOrganizations.displayName,
      organizationId: editorialCustodianships.organizationId,
      ownerName: organizations.displayName,
    })
    .from(editorialEntries)
    .innerJoin(
      basicInformationDetails,
      eq(basicInformationDetails.entryId, editorialEntries.id),
    )
    .leftJoin(
      editorialCustodianships,
      and(
        eq(editorialCustodianships.entryId, editorialEntries.id),
        isNull(editorialCustodianships.endedAt),
      ),
    )
    .leftJoin(
      organizations,
      eq(organizations.id, editorialCustodianships.organizationId),
    )
    .leftJoin(
      answeringOrganizations,
      eq(
        answeringOrganizations.id,
        basicInformationDetails.answeredByOrganizationId,
      ),
    )
    .where(
      and(
        eq(editorialEntries.kind, "basic_information"),
        ownedWithin(editorialCustodianships.organizationId, scope),
      ),
    )
    // The reading order, not the editing order: this list is the block, and its
    // sequence is what a reader in trouble meets first.
    .orderBy(asc(basicInformationDetails.priority), asc(editorialEntries.slug));

  const entryIds = entryRows.map((row) => row.id);

  const revisionRows = entryIds.length
    ? await db
        .select()
        .from(editorialRevisions)
        .where(inArray(editorialRevisions.entryId, entryIds))
        .orderBy(desc(editorialRevisions.revisionNumber))
    : [];
  const latestRevisionByEntry = new Map<
    string,
    (typeof revisionRows)[number]
  >();
  for (const revision of revisionRows) {
    if (!latestRevisionByEntry.has(revision.entryId)) {
      latestRevisionByEntry.set(revision.entryId, revision);
    }
  }
  const latestRevisionIds = [...latestRevisionByEntry.values()].map(
    (revision) => revision.id,
  );

  const translationRows = latestRevisionIds.length
    ? await db
        .select()
        .from(editorialRevisionTranslations)
        .where(
          inArray(editorialRevisionTranslations.revisionId, latestRevisionIds),
        )
    : [];
  const translationsByRevision = new Map<
    string,
    (typeof translationRows)[number][]
  >();
  for (const translation of translationRows) {
    const list = translationsByRevision.get(translation.revisionId) ?? [];
    list.push(translation);
    translationsByRevision.set(translation.revisionId, list);
  }

  // Everyone the page names by name: whoever verified one of the translations.
  const verifierIds = [
    ...new Set(
      translationRows.flatMap((translation) =>
        translation.verifiedById ? [translation.verifiedById] : [],
      ),
    ),
  ];
  const personRows = verifierIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, verifierIds))
    : [];
  const personById = new Map(personRows.map((person) => [person.id, person]));

  const publicationRows = entryIds.length
    ? await db
        .select()
        .from(editorialPublications)
        .where(
          and(
            inArray(editorialPublications.entryId, entryIds),
            isNull(editorialPublications.unpublishedAt),
          ),
        )
    : [];
  const publicationNow = new Date();
  const activePublicationsByEntry = new Map<
    string,
    (typeof publicationRows)[number][]
  >();
  const scheduledPublicationsByEntry = new Map<
    string,
    (typeof publicationRows)[number][]
  >();
  for (const publication of publicationRows) {
    const scheduled =
      publication.scheduledFor && publication.scheduledFor > publicationNow;
    const target = scheduled
      ? scheduledPublicationsByEntry
      : activePublicationsByEntry;
    const list = target.get(publication.entryId) ?? [];
    list.push(publication);
    target.set(publication.entryId, list);
  }

  const titleOf = (entryId: string) => {
    const revision = latestRevisionByEntry.get(entryId);
    const list = revision
      ? (translationsByRevision.get(revision.id) ?? [])
      : [];
    return (
      list.find((row) => row.languageCode === locale)?.title ??
      list.find((row) => row.languageCode === "fr")?.title ??
      list[0]?.title ??
      t.untitled
    );
  };

  const contacts = entryRows.map((entry) => {
    const activePublications = activePublicationsByEntry.get(entry.id) ?? [];
    const scheduledPublications =
      scheduledPublicationsByEntry.get(entry.id) ?? [];
    // What the list shows folds the workflow together with live publications: an
    // entry can be "published" without the workflow having said so.
    const displayState: ArticleStateValue =
      entry.archivedAt !== null
        ? "archived"
        : activePublications.length > 0
          ? "published"
          : scheduledPublications.length > 0
            ? "scheduled"
            : entry.workflowState;
    const revision = latestRevisionByEntry.get(entry.id);
    const freshness = freshnessOf({
      lastVerifiedAt: revision?.lastReviewedAt ?? null,
      reviewDueAt: revision?.reviewDueAt ?? null,
    });
    return {
      ...entry,
      displayState,
      title: titleOf(entry.id),
      revisionNumber: revision?.revisionNumber ?? 1,
      lastReviewedAt: revision?.lastReviewedAt ?? null,
      reviewDueAt: revision?.reviewDueAt ?? null,
      freshness,
      publishedLanguages: activePublications.map(
        (publication) => publication.languageCode,
      ),
      // A language waiting for its date is a promise too, so it counts against
      // archiving exactly as a live one does.
      hasPublication:
        activePublications.length > 0 || scheduledPublications.length > 0,
    };
  });

  const selected = search.entry
    ? contacts.find((contact) => contact.id === search.entry)
    : undefined;
  const publishedCount = contacts.filter(
    (contact) => contact.displayState === "published",
  ).length;
  /**
   * What is waiting on somebody. On this kind that is not the workflow but the
   * calendar: a number nobody has checked since the association reorganised is
   * live and wrong, which is worse than a draft.
   */
  const attentionCount = contacts.filter(
    (contact) =>
      contact.archivedAt === null &&
      (contact.freshness === "overdue" ||
        contact.freshness === "due_soon" ||
        contact.freshness === "never"),
  ).length;

  /** "Last checked 4 Mar", "Overdue since 1 Feb", "Never checked". */
  const checkedLabelOf = (contact: (typeof contacts)[number]) => {
    if (!contact.lastReviewedAt) return t["freshness.never"];
    if (contact.freshness === "overdue" && contact.reviewDueAt) {
      return t["freshness.overdue"].replace(
        "{date}",
        localeDate(contact.reviewDueAt, locale),
      );
    }
    return t["freshness.lastChecked"].replace(
      "{date}",
      localeDate(contact.lastReviewedAt, locale),
    );
  };

  const tableRows: BasicInformationTableRow[] = contacts.map((contact) => ({
    id: contact.id,
    href: localizedPath("/dashboard/basics", locale, { entry: contact.id }),
    title: contact.title,
    slug: contact.slug,
    revisionLabel: t["overview.revision"].replace(
      "{n}",
      String(contact.revisionNumber),
    ),
    dial: contact.dial,
    reachLabel: contact.reach ? t[`reach.${contact.reach}`] : null,
    emergency: contact.emergency,
    owner: contact.ownerName ?? t["scope.platform"],
    answeredBy: contact.answeredByName ?? t["field.answeredBy.none"],
    state: contact.displayState,
    publishedLanguages: contact.publishedLanguages,
    checkedLabel: checkedLabelOf(contact),
    checkedOverdue:
      contact.freshness === "overdue" || contact.freshness === "never",
    archived: contact.archivedAt !== null,
    canArchive: !contact.hasPublication,
  }));

  const tableLabels: BasicsTableLabels = {
    search: t["table.search"],
    searchPlaceholder: t["list.searchPlaceholder"],
    columns: t["table.columns"],
    clear: t["table.clear"],
    filterBy: t["table.filterBy"],
    noMatch: t["list.noResults"],
    rowsPerPage: t["table.rowsPerPage"],
    results: t["table.results"],
    page: t["table.page"],
    previous: t["table.previous"],
    next: t["table.next"],
    contact: t["list.contactColumn"],
    dial: t["list.dialColumn"],
    owner: t["list.ownerColumn"],
    answeredBy: t["list.answeredByColumn"],
    status: t["list.statusColumn"],
    languages: t["list.languagesColumn"],
    checked: t["list.checkedColumn"],
    emergency: t["list.emergency"],
    noDial: t["list.noDial"],
    // Punctuation, not wording: an empty cell reads as a missing value.
    none: "—",
    stateLabels: Object.fromEntries(
      ARTICLE_STATES.map((state) => [state, t[`state.${state}`]]),
    ) as Record<ArticleStateValue, string>,
    languageLabels: Object.fromEntries(
      editorialLanguageCodes.map((code) => [code, t[`language.${code}`]]),
    ),
    actions: t["table.actions"],
    open: t["rowAction.open"],
    unpublish: t["rowAction.unpublish"],
    unpublishTitle: t["rowAction.unpublishTitle"],
    unpublishBody: t["rowAction.unpublishBody"],
    unpublishConfirm: t["rowAction.unpublishConfirm"],
    unpublished: t["toast.unpublished"],
    archive: t["action.archive"],
    archiveTitle: t["action.archiveConfirmTitle"],
    archiveBody: t["action.archiveConfirmBody"],
    archiveConfirm: t["action.archiveConfirm"],
    archived: t["toast.archived"],
    restore: t["action.restore"],
    restored: t["toast.restored"],
    cancel: t["action.cancel"],
    actionError: t["toast.actionError"],
  };

  // ---- Selected contact detail -----------------------------------------
  let detail: {
    contentKey: string;
    languages: BasicInformationLanguageStatus[];
    sourceLanguage: ContentLanguage;
    history: { key: string; label: string; at: Date; by: string | null }[];
    revisionNumber: number;
    reviewIntervalDays: number;
    categories: BasicInformationOptionRow[];
    organizations: BasicInformationOptionRow[];
  } | null = null;

  if (selected) {
    const revision = latestRevisionByEntry.get(selected.id);
    const sourceLanguage = (revision?.sourceLanguageCode ??
      "fr") as ContentLanguage;
    const translations = revision
      ? (translationsByRevision.get(revision.id) ?? [])
      : [];
    const currentPublications = publicationRows.filter(
      (publication) => publication.entryId === selected.id,
    );

    const languages: BasicInformationLanguageStatus[] = contentLanguages.map(
      (code) => {
        const translation = translations.find(
          (row) => row.languageCode === code,
        );
        const publication = currentPublications.find(
          (row) => row.languageCode === code,
        );
        const isScheduled = Boolean(
          publication?.scheduledFor &&
          publication.scheduledFor > publicationNow,
        );
        return {
          code,
          saved: translation !== undefined,
          title: translation?.title ?? null,
          summary: translation?.summary ?? null,
          state: translation?.state ?? "draft",
          method: translation?.method ?? "human",
          reviewStage: translation?.reviewStage ?? "none",
          publishedAt:
            publication && !isScheduled
              ? localePublicationDateTime(
                  publication.scheduledFor ?? publication.publishedAt,
                  locale,
                )
              : null,
          scheduledFor:
            publication?.scheduledFor && isScheduled
              ? localePublicationDateTime(publication.scheduledFor, locale)
              : null,
          verifiedBy: translation?.verifiedById
            ? (personById.get(translation.verifiedById) ?? null)
            : null,
        };
      },
    );

    const [
      historyRevisions,
      historyPublications,
      categoryRows,
      organizationRows,
    ] = await Promise.all([
      db
        .select({
          revisionNumber: editorialRevisions.revisionNumber,
          createdAt: editorialRevisions.createdAt,
          lastReviewedAt: editorialRevisions.lastReviewedAt,
          authorName: users.name,
        })
        .from(editorialRevisions)
        .leftJoin(users, eq(users.id, editorialRevisions.authorId))
        .where(eq(editorialRevisions.entryId, selected.id))
        .orderBy(desc(editorialRevisions.revisionNumber)),
      db
        .select({
          languageCode: editorialPublications.languageCode,
          publishedAt: editorialPublications.publishedAt,
          scheduledFor: editorialPublications.scheduledFor,
          unpublishedAt: editorialPublications.unpublishedAt,
        })
        .from(editorialPublications)
        .where(eq(editorialPublications.entryId, selected.id))
        .orderBy(desc(editorialPublications.publishedAt)),
      // The same taxonomy the activities are filed under, so a number and the
      // published activities answering the same need can sit together.
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
        .orderBy(
          asc(serviceCategories.displayOrder),
          asc(serviceCategories.code),
        ),
      db
        .select({ id: organizations.id, label: organizations.displayName })
        .from(organizations)
        .orderBy(organizations.displayName),
    ]);

    const history: {
      key: string;
      label: string;
      at: Date;
      by: string | null;
    }[] = [];
    for (const item of historyRevisions) {
      const revisionNumber = String(item.revisionNumber);
      history.push({
        key: `rev-${revisionNumber}`,
        label: t["history.revisionCreated"].replace("{n}", revisionNumber),
        at: item.createdAt,
        by: item.authorName,
      });
      /**
       * "Somebody rang this number and it answered" is the entry this timeline
       * exists for, and it is not a revision: confirming a number edits the
       * revision in place, so the check shows only where it moved past the
       * moment the revision was written.
       */
      if (
        item.lastReviewedAt &&
        item.lastReviewedAt.getTime() > item.createdAt.getTime()
      ) {
        history.push({
          key: `checked-${revisionNumber}`,
          label: t["history.checked"],
          at: item.lastReviewedAt,
          by: null,
        });
      }
    }
    for (const item of historyPublications) {
      const language = t[`language.${item.languageCode}` as keyof typeof t];
      const scheduled = item.scheduledFor && item.scheduledFor > publicationNow;
      history.push({
        key: `pub-${item.languageCode}-${item.publishedAt.toISOString()}`,
        label: (scheduled
          ? t["history.scheduled"]
          : t["history.published"]
        ).replace("{language}", language),
        at: item.scheduledFor ?? item.publishedAt,
        by: null,
      });
      if (item.unpublishedAt) {
        history.push({
          key: `unpub-${item.languageCode}-${item.unpublishedAt.toISOString()}`,
          label: t["history.unpublished"].replace("{language}", language),
          at: item.unpublishedAt,
          by: null,
        });
      }
    }
    history.sort((a, b) => b.at.getTime() - a.at.getTime());

    detail = {
      contentKey: translations
        .map(
          (translation) =>
            `${translation.languageCode}:${translation.contentHash ?? ""}`,
        )
        .sort()
        .join("|"),
      languages,
      sourceLanguage,
      history,
      revisionNumber: revision?.revisionNumber ?? 1,
      reviewIntervalDays: intervalFrom(
        revision?.lastReviewedAt ?? null,
        revision?.reviewDueAt ?? null,
      ),
      categories: categoryRows.map((category) => ({
        id: category.id,
        label: category.label ?? category.code,
      })),
      organizations: organizationRows,
    };
  }

  /**
   * What this editor may ask of one language, and therefore what its menu
   * offers. Every item is re-checked by the action behind it.
   *
   * The review chain rides the article adapter: `content.basic_information.*`
   * has no third reviewer code (server/auth/authorization.ts), and
   * `editorial_entry` resolves to the article adapter in
   * server/content/language-review.ts — so the two review permissions asked here
   * are the article's, which the one role holding the basics grants also holds
   * (server/db/seed.ts). The visible consequence is that the menu's refusal copy
   * says "article"; the gate itself is correct.
   */
  const languageAbilities = selected
    ? {
        canPublish: await hasPermission(
          "content.basic_information.publish",
          selected.organizationId ?? undefined,
        ),
        canTeamValidate: await hasPermission(
          "content.article.review",
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
  const canVerifyTranslations = selected
    ? await hasPermission(
        "content.translation.verify",
        selected.organizationId ?? undefined,
      )
    : false;

  const createContact = (
    <Button
      nativeButton={false}
      render={<Link href={localizedPath("/dashboard/basics/new", locale)} />}
    >
      <Plus aria-hidden />
      {t["create.cta"]}
    </Button>
  );
  const contactFormId = selected ? `basic-information-${selected.id}` : "";

  return (
    <WorkspacePage>
      {!selected ? (
        <PageHeader
          title={t.title}
          sub={t.sub}
          action={contacts.length === 0 ? createContact : null}
        />
      ) : null}

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="text-copy-muted py-12 text-center text-sm">
            {t.empty}
          </CardContent>
        </Card>
      ) : !selected ? (
        <>
          <StatGrid>
            <Stat label={t["list.totalEntries"]} value={contacts.length} />
            <Stat label={t["list.publishedEntries"]} value={publishedCount} />
            <Stat label={t["list.attentionEntries"]} value={attentionCount} />
          </StatGrid>

          <BasicsTable
            rows={tableRows}
            locale={locale}
            labels={tableLabels}
            createAction={createContact}
          />

          {/* The order of the block, below the list rather than inside it: it is
           * a decision about the whole set, and the table is where individual
           * rows are worked on.
           *
           * `mt-5` because `WorkspacePage` puts no gap between its children —
           * this page spaces itself with component margins, the way `StatGrid`
           * carries its own `mb-5` — so without it the card sat flush against
           * the bottom of the table and read as part of it. */}
          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListOrdered className="size-4 shrink-0" aria-hidden />
                {t["order.heading"]}
              </CardTitle>
              <CardDescription>{t["order.hint"]}</CardDescription>
            </CardHeader>
            <CardContent>
              <BasicInformationOrderForm
                locale={locale}
                entries={contacts
                  .filter((contact) => contact.archivedAt === null)
                  .map((contact) => ({
                    id: contact.id,
                    title: contact.title,
                    emergency: contact.emergency,
                  }))}
                labels={t}
              />
            </CardContent>
          </Card>
        </>
      ) : detail && languageAbilities ? (
        <div className="min-w-0 space-y-5">
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href={localizedPath("/dashboard/basics", locale)} />}
          >
            <ArrowLeft aria-hidden />
            {t["create.back"]}
          </Button>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Phone className="size-5 shrink-0" aria-hidden />
                    <span className="truncate">{selected.title}</span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    /{selected.slug} ·{" "}
                    {t["overview.revision"].replace(
                      "{n}",
                      String(detail.revisionNumber),
                    )}
                  </CardDescription>
                </div>
                <BasicInformationWorkflowBar
                  locale={locale}
                  entryId={selected.id}
                  archived={selected.archivedAt !== null}
                  canArchive={!selected.hasPublication}
                  labels={t}
                />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="text-copy-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Badge
                    variant={workflowBadge[selected.displayState] ?? "outline"}
                  >
                    {t[`state.${selected.displayState}` as keyof typeof t]}
                  </Badge>
                </span>
                {selected.dial ? (
                  <span dir="ltr" className="text-ink font-medium tabular-nums">
                    {selected.dial}
                  </span>
                ) : null}
                <span>
                  {t["overview.owner"]}:{" "}
                  <span className="text-ink font-medium">
                    {selected.ownerName ?? t["scope.platform"]}
                  </span>
                </span>
                <span>
                  {t["overview.answeredBy"]}:{" "}
                  <span className="text-ink font-medium">
                    {selected.answeredByName ?? t["field.answeredBy.none"]}
                  </span>
                </span>
                <span>
                  {t["overview.sourceLanguage"]}:{" "}
                  <span className="text-ink font-medium">
                    {t[`language.${detail.sourceLanguage}` as keyof typeof t]}
                  </span>
                </span>
              </div>
              {/* The one warning this page carries: a number nobody has rung
                  since it was due is live and possibly wrong. */}
              {selected.freshness === "overdue" ||
              selected.freshness === "never" ? (
                <div className="border-warn/50 bg-warn-soft text-warn flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  {checkedLabelOf(selected)}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">{t["detail.content"]}</CardTitle>
            </CardHeader>
            <CardContent>
              <BasicInformationEditorForm
                key={`${selected.id}-${String(detail.revisionNumber)}-${detail.contentKey}`}
                formId={contactFormId}
                locale={locale}
                entryId={selected.id}
                organizationId={selected.organizationId ?? undefined}
                sourceLanguage={detail.sourceLanguage}
                detail={{
                  icon: selected.icon,
                  priority: selected.priority,
                  emergency: selected.emergency,
                  operator: selected.operator,
                  categoryId: selected.categoryId,
                  dial: selected.dial,
                  reach: selected.reach,
                  dialInstead: selected.dialInstead,
                  answeredByOrganizationId: selected.answeredByOrganizationId,
                }}
                categories={detail.categories}
                organizations={detail.organizations}
                languages={detail.languages}
                archived={selected.archivedAt !== null}
                abilities={languageAbilities}
                aiEnabled={hasAiTranslationProvider()}
                canVerify={canVerifyTranslations}
                returnPath={localizedPath("/dashboard/basics", locale, {
                  entry: selected.id,
                })}
                aside={
                  <div className="grid gap-5">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {t["detail.freshness"]}
                        </CardTitle>
                        <CardDescription>{t["freshness.hint"]}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <BasicInformationFreshnessForm
                          key={selected.id}
                          locale={locale}
                          entryId={selected.id}
                          reviewIntervalDays={detail.reviewIntervalDays}
                          lastCheckedLabel={
                            selected.lastReviewedAt
                              ? t["freshness.lastChecked"].replace(
                                  "{date}",
                                  localeDate(selected.lastReviewedAt, locale),
                                )
                              : t["freshness.never"]
                          }
                          dueLabel={
                            selected.reviewDueAt
                              ? (selected.freshness === "overdue"
                                  ? t["freshness.overdue"]
                                  : t["freshness.dueOn"]
                                ).replace(
                                  "{date}",
                                  localeDate(selected.reviewDueAt, locale),
                                )
                              : null
                          }
                          overdue={selected.freshness === "overdue"}
                          disabled={selected.archivedAt !== null}
                          labels={t}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {t["detail.history"]}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pe-2">
                        <HistoryTimeline
                          entries={detail.history}
                          locale={locale}
                          labels={{
                            ariaLabel: t["detail.history"],
                            empty: t["history.empty"],
                            by: t["history.by"],
                          }}
                        />
                      </CardContent>
                    </Card>
                  </div>
                }
                labels={t}
                saveLabels={{
                  save: t["action.saveContent"],
                  saved: t["toast.saved"],
                  saveError: t["toast.saveError"],
                }}
                editorLabels={editorLabels}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </WorkspacePage>
  );
}
