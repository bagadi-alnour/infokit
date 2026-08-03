import { isPublicLocale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  ArrowLeft,
  CalendarDays,
  FileImage,
  FileText,
  Plus,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import {
  ArticleDownloadsManager,
  ArticleMediaManager,
} from "~/components/admin/article-media-manager";
import {
  ArticleEditorForm,
  ArticleFreshnessForm,
  ArticleSources,
  ArticleWorkflowBar,
  type ArticleLanguageStatus,
  type ArticleSource,
} from "~/components/admin/article-manage";
import {
  ArticlesTable,
  type ArticlesTableLabels,
  type ArticleTableRow,
} from "~/components/admin/articles-table";
import {
  ARTICLE_STATES,
  type ArticleStateValue,
} from "~/components/admin/content-states";
import { StewardContactForm } from "~/components/admin/steward-contact-form";
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
  editorialLanguageCodes,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import { buildWorkspaceLabels } from "~/lib/workspace-labels";
import { hasAiTranslationProvider } from "~/server/ai/provider";
import { createAssetReadUrl } from "~/server/assets/s3";
import { auth } from "~/server/auth";
import {
  articleWorkspacePermissions,
  hasActualPlatformPermission,
  ownedWithin,
  permissionScopeAny,
} from "~/server/auth/authorization";
import { denyPageAccess, hasPermission } from "~/server/auth/require";
import { platformVerifyPermission } from "~/server/content/language-review";
import { loadStewardCandidates } from "~/server/content/steward-candidates";
import { db } from "~/server/db";
import {
  articleDetails,
  assets,
  assetTranslations,
  editorialCustodianships,
  editorialEntries,
  editorialEntryAssets,
  editorialEntryRoutes,
  editorialEntryTags,
  editorialPublications,
  editorialRevisions,
  editorialRevisionSources,
  editorialRevisionTranslations,
  organizations,
  sources,
  tags,
  tagTranslations,
  translationAssignments,
  users,
} from "~/server/db/schema";
import { updateEditorialSteward } from "../steward-actions";

const contentLanguages = editorialLanguageCodes;
type ContentLanguage = EditorialLanguage;

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

function bodyHtmlOf(bodyJson: unknown): string {
  if (bodyJson && typeof bodyJson === "object" && "html" in bodyJson) {
    const html = (bodyJson as { html?: unknown }).html;
    return typeof html === "string" ? html : "";
  }
  return "";
}

const workflowBadge: Record<string, "default" | "secondary" | "outline"> = {
  published: "default",
  scheduled: "secondary",
  in_review: "secondary",
  unpublished: "outline",
  draft: "outline",
  archived: "outline",
};

export default async function ArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ article?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const search = await searchParams;
  const [t, shared, overview] = await Promise.all([
    loadPageCatalog(locale, "dashboard-articles"),
    // The steward contact reads from the shared console catalogue, so the
    // wording is the same on every content type.
    loadPageCatalog(locale, "dashboard-console"),
    // The editor and its language accordion speak one vocabulary everywhere.
    loadPageCatalog(locale, "dashboard-overview"),
  ]);
  const editorLabels = buildWorkspaceLabels(overview, t, shared);
  const session = await auth();
  const viewerId = session?.user.id ?? null;
  // A platform administrator answers for content whose author has left, and for
  // seeded articles nobody wrote.
  const canManageGlobal = Boolean(
    viewerId &&
    (await hasActualPlatformPermission(viewerId, "support.superadmin")),
  );
  // What this reader administers. Custody is what owns an article, so the scope
  // is applied to the custodianship rather than to the entry — an entry the
  // platform holds has no custodian organisation, and belongs to no association's
  // list.
  const scope =
    (viewerId
      ? await permissionScopeAny(viewerId, articleWorkspacePermissions)
      : null) ?? (await denyPageAccess(articleWorkspacePermissions[0], locale));

  // ---- Article list (each entry with its latest revision) ---------------
  const entryRows = await db
    .select({
      id: editorialEntries.id,
      slug: editorialEntries.slug,
      workflowState: editorialEntries.workflowState,
      archivedAt: editorialEntries.archivedAt,
      updatedAt: editorialEntries.updatedAt,
      articleDate: articleDetails.articleDate,
      featured: articleDetails.featured,
      // Workspace-only: who to ask about this entry. Never read publicly.
      stewardName: editorialEntries.stewardName,
      stewardPhone: editorialEntries.stewardPhone,
      stewardEmail: editorialEntries.stewardEmail,
      custodianKind: editorialCustodianships.custodianKind,
      organizationId: editorialCustodianships.organizationId,
      ownerName: organizations.displayName,
    })
    .from(editorialEntries)
    .innerJoin(articleDetails, eq(articleDetails.entryId, editorialEntries.id))
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
    .where(
      and(
        eq(editorialEntries.kind, "article"),
        ownedWithin(editorialCustodianships.organizationId, scope),
      ),
    )
    .orderBy(desc(editorialEntries.updatedAt));

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
  // The first revision is the article's authorship: later ones are edits, so
  // the lowest revision number is who created it — compared as a number rather
  // than trusted to be last in an order that may change.
  const firstRevisionByEntry = new Map<string, (typeof revisionRows)[number]>();
  for (const revision of revisionRows) {
    if (!latestRevisionByEntry.has(revision.entryId)) {
      latestRevisionByEntry.set(revision.entryId, revision);
    }
    const first = firstRevisionByEntry.get(revision.entryId);
    if (!first || revision.revisionNumber < first.revisionNumber) {
      firstRevisionByEntry.set(revision.entryId, revision);
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

  // One lookup for every person the page names: whoever wrote an article, and
  // whoever verified one of its translations.
  const personIds = [
    ...new Set([
      ...translationRows.flatMap((translation) =>
        translation.verifiedById ? [translation.verifiedById] : [],
      ),
      ...[...firstRevisionByEntry.values()].flatMap((revision) =>
        revision.authorId ? [revision.authorId] : [],
      ),
    ]),
  ];
  const personRows = personIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, personIds))
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

  // Each language has its own public URL, generated from its own title. Retired
  // routes are left out: they still redirect, but they are not where an editor
  // asking to see the public page should land.
  const routeRows = entryIds.length
    ? await db
        .select({
          entryId: editorialEntryRoutes.entryId,
          languageCode: editorialEntryRoutes.languageCode,
          slug: editorialEntryRoutes.slug,
        })
        .from(editorialEntryRoutes)
        .where(
          and(
            inArray(editorialEntryRoutes.entryId, entryIds),
            isNull(editorialEntryRoutes.retiredAt),
          ),
        )
    : [];
  const routesByEntry = new Map<string, Map<string, string>>();
  for (const route of routeRows) {
    const byLanguage =
      routesByEntry.get(route.entryId) ?? new Map<string, string>();
    byLanguage.set(route.languageCode, route.slug);
    routesByEntry.set(route.entryId, byLanguage);
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

  const articles = entryRows.map((entry) => {
    const activePublications = activePublicationsByEntry.get(entry.id) ?? [];
    const scheduledPublications =
      scheduledPublicationsByEntry.get(entry.id) ?? [];
    // What the list shows folds the workflow together with live publications:
    // an entry can be "published" without the workflow having said so.
    const displayState: ArticleStateValue =
      entry.archivedAt !== null
        ? "archived"
        : activePublications.length > 0
          ? "published"
          : scheduledPublications.length > 0
            ? "scheduled"
            : entry.workflowState;
    const authorId = firstRevisionByEntry.get(entry.id)?.authorId ?? null;
    return {
      ...entry,
      displayState,
      title: titleOf(entry.id),
      revisionNumber: latestRevisionByEntry.get(entry.id)?.revisionNumber ?? 1,
      publishedLanguages: activePublications.map(
        (publication) => publication.languageCode,
      ),
      // Who wrote it. The association answers for the article; this is the
      // person to ask what they meant.
      authorId,
      authorName: authorId ? (personById.get(authorId)?.name ?? null) : null,
      // A language waiting for its date is a promise too, so it counts against
      // archiving exactly as a live one does.
      hasPublication:
        activePublications.length > 0 || scheduledPublications.length > 0,
    };
  });

  const selected = search.article
    ? articles.find((article) => article.id === search.article)
    : undefined;
  /**
   * Who the platform can already name for the contact card: the custodian
   * organisation's roster, and whoever wrote the entry — the only candidate
   * there is on one the platform holds itself.
   */
  const stewardCandidates = await loadStewardCandidates({
    organizationId: selected?.organizationId,
    authorId: selected?.authorId,
  });
  const publishedArticleCount = articles.filter(
    (article) => article.displayState === "published",
  ).length;
  const attentionArticleCount = articles.filter((article) =>
    ["draft", "in_review", "unpublished"].includes(article.displayState),
  ).length;

  /**
   * The public page of an article, when it has one: the workspace language if it
   * is live, otherwise the first published language with a route of its own.
   */
  const publicArticleHref = (entryId: string, languages: string[]) => {
    const routes = routesByEntry.get(entryId);
    if (!routes) return null;
    const ordered = languages.includes(locale)
      ? [locale, ...languages.filter((code) => code !== locale)]
      : languages;
    for (const code of ordered) {
      const slug = routes.get(code);
      if (slug && isPublicLocale(code)) {
        return localizedPath(`/articles/${slug}`, code);
      }
    }
    return null;
  };

  // Who may operate on a row from the list: whoever wrote it answers for it.
  // Compared on the server; the browser is told the answer, not the identity it
  // was derived from.
  const mayEdit = (authorId: string | null) =>
    canManageGlobal || (viewerId !== null && authorId === viewerId);

  const tableRows: ArticleTableRow[] = articles.map((article) => {
    const canEdit = mayEdit(article.authorId);
    return {
      id: article.id,
      href: localizedPath("/dashboard/articles", locale, {
        article: article.id,
      }),
      title: article.title,
      slug: article.slug,
      revisionLabel: t["overview.revision"].replace(
        "{n}",
        String(article.revisionNumber),
      ),
      featured: article.featured,
      owner: article.ownerName ?? t["scope.platform"],
      createdBy: article.authorName,
      state: article.displayState,
      publishedLanguages: article.publishedLanguages,
      updatedAtIso: article.updatedAt.toISOString(),
      updatedLabel: localeDate(article.updatedAt, locale),
      draft: article.workflowState === "draft",
      archived: article.archivedAt !== null,
      publicHref: publicArticleHref(article.id, article.publishedLanguages),
      canEdit,
      canArchive: canEdit && !article.hasPublication,
    };
  });

  const tableLabels: ArticlesTableLabels = {
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
    article: t["list.articleColumn"],
    owner: t["list.ownerColumn"],
    createdBy: t["list.createdByColumn"],
    status: t["list.statusColumn"],
    languages: t["list.languagesColumn"],
    updated: t["list.updatedColumn"],
    featured: t["list.featured"],
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
    view: t["rowAction.view"],
    viewPublic: t["rowAction.viewPublic"],
    unpublish: t["rowAction.unpublish"],
    unpublishTitle: t["rowAction.unpublishTitle"],
    unpublishBody: t["rowAction.unpublishBody"],
    unpublishConfirm: t["rowAction.unpublishConfirm"],
    unpublished: t["toast.unpublished"],
    submit: t["action.submit"],
    submitted: t["toast.submitted"],
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

  // ---- Selected article detail -----------------------------------------
  let detail: {
    contentKey: string;
    languages: ArticleLanguageStatus[];
    sourceLanguage: ContentLanguage;
    sourceList: ArticleSource[];
    history: { key: string; label: string; at: Date; by: string | null }[];
    revisionNumber: number;
    canBecomeOutdated: boolean;
    unreliableFrom: string | null;
    sourceSummary: string | null;
    tags: { value: string; label: string; description: string }[];
    selectedTagIds: string[];
    cover: {
      assetId: string;
      previewUrl: string;
      altText: string;
    } | null;
    downloads: { assetId: string; title: string }[];
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
    const assignmentRows = await db
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
          eq(translationAssignments.entityKind, "editorial_entry"),
          eq(translationAssignments.entityId, selected.id),
          isNull(translationAssignments.revokedAt),
          isNull(translationAssignments.expiredAt),
        ),
      )
      .orderBy(desc(translationAssignments.createdAt));
    const assignmentByLanguage = new Map<
      string,
      (typeof assignmentRows)[number]
    >();
    for (const assignment of assignmentRows) {
      if (!assignmentByLanguage.has(assignment.languageCode)) {
        assignmentByLanguage.set(assignment.languageCode, assignment);
      }
    }

    const languages: ArticleLanguageStatus[] = contentLanguages.map((code) => {
      const translation = translations.find((row) => row.languageCode === code);
      const publication = currentPublications.find(
        (row) => row.languageCode === code,
      );
      const isScheduled = Boolean(
        publication?.scheduledFor && publication.scheduledFor > publicationNow,
      );
      const assignment = assignmentByLanguage.get(code);
      return {
        code,
        saved: translation !== undefined,
        title: translation?.title ?? null,
        summary: translation?.summary ?? null,
        bodyHtml: translation ? bodyHtmlOf(translation.bodyJson) : null,
        plainText: translation?.plainText ?? null,
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
        assignment: assignment
          ? {
              id: assignment.id,
              state:
                assignment.expiresAt <= new Date() &&
                !["accepted", "rejected", "published"].includes(
                  assignment.state,
                )
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

    const [
      sourceList,
      historyRevisions,
      historyPublications,
      availableTagRows,
      selectedTagRows,
      coverRows,
      downloadRows,
    ] = await Promise.all([
      revision
        ? db
            .select({
              id: sources.id,
              title: sources.title,
              publisher: sources.publisher,
              url: sources.url,
              sourceDate: sources.sourceDate,
            })
            .from(editorialRevisionSources)
            .innerJoin(
              sources,
              eq(sources.id, editorialRevisionSources.sourceId),
            )
            .where(eq(editorialRevisionSources.revisionId, revision.id))
            .orderBy(editorialRevisionSources.displayOrder)
        : Promise.resolve([]),
      db
        .select({
          revisionNumber: editorialRevisions.revisionNumber,
          createdAt: editorialRevisions.createdAt,
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
        .select({ tagId: editorialEntryTags.tagId })
        .from(editorialEntryTags)
        .where(eq(editorialEntryTags.entryId, selected.id))
        .orderBy(asc(editorialEntryTags.displayOrder)),
      db
        .select({
          assetId: editorialEntryAssets.assetId,
          storageKey: assets.storageKey,
          mimeType: assets.mimeType,
          altText: assetTranslations.altText,
        })
        .from(editorialEntryAssets)
        .innerJoin(assets, eq(assets.id, editorialEntryAssets.assetId))
        .leftJoin(
          assetTranslations,
          and(
            eq(assetTranslations.assetId, editorialEntryAssets.assetId),
            eq(assetTranslations.languageCode, sourceLanguage),
          ),
        )
        .where(
          and(
            eq(editorialEntryAssets.entryId, selected.id),
            eq(editorialEntryAssets.role, "cover"),
          ),
        )
        .limit(1),
      // The documents offered with the article. Their titles live on the asset's
      // own translation, so a platform-owned article can carry one — see
      // `addArticleDownload`.
      db
        .select({
          assetId: editorialEntryAssets.assetId,
          title: assetTranslations.title,
        })
        .from(editorialEntryAssets)
        .innerJoin(assets, eq(assets.id, editorialEntryAssets.assetId))
        .leftJoin(
          assetTranslations,
          and(
            eq(assetTranslations.assetId, editorialEntryAssets.assetId),
            eq(assetTranslations.languageCode, sourceLanguage),
          ),
        )
        .where(
          and(
            eq(editorialEntryAssets.entryId, selected.id),
            eq(editorialEntryAssets.role, "attachment"),
            isNull(assets.archivedAt),
          ),
        )
        .orderBy(asc(editorialEntryAssets.displayOrder)),
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

    const availableTagIds = new Set(availableTagRows.map((tag) => tag.id));
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
      sourceList,
      history,
      revisionNumber: revision?.revisionNumber ?? 1,
      canBecomeOutdated: revision?.canBecomeOutdated ?? false,
      unreliableFrom: revision?.unreliableFrom ?? null,
      sourceSummary: revision?.sourceSummary ?? null,
      tags: availableTagRows.map((tag) => ({
        value: tag.id,
        label: tag.label ?? tag.code,
        description: tag.namespace,
      })),
      selectedTagIds: selectedTagRows
        .map((tag) => tag.tagId)
        .filter((tagId) => availableTagIds.has(tagId)),
      cover: coverRows[0]
        ? {
            assetId: coverRows[0].assetId,
            previewUrl: await createAssetReadUrl(coverRows[0].storageKey, {
              contentType: coverRows[0].mimeType,
            }),
            altText: coverRows[0].altText ?? t["image.attached"],
          }
        : null,
      downloads: downloadRows.map((row) => ({
        assetId: row.assetId,
        // A document whose title never landed still has to be nameable, or the
        // only way to remove it would be to guess which row it is.
        title: row.title ?? t["download.untitled"],
      })),
    };
  }

  /**
   * What this editor may ask of one language, and therefore what its menu
   * offers. Every item is re-checked by the action behind it; this only decides
   * what is worth showing.
   *
   * Clearing a language for the public is asked platform-wide, with no
   * organisation named — the same call `decideLanguageReview` makes, so an
   * association's own reviewer is not shown a decision the platform reserves.
   */
  const languageAbilities = selected
    ? {
        canPublish:
          mayEdit(selected.authorId) &&
          (await hasPermission(
            "content.article.publish",
            selected.organizationId ?? undefined,
          )),
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

  // Writing an article belongs to the list's own toolbar, beside the controls
  // that shape the list. The header keeps it only while there is no list yet —
  // the first article has to be writable from an empty page.
  const createArticle = (
    <Button
      nativeButton={false}
      render={<Link href={localizedPath("/dashboard/articles/new", locale)} />}
    >
      <Plus aria-hidden />
      {t["create.cta"]}
    </Button>
  );
  const articleFormId = selected ? `article-content-${selected.id}` : "";

  return (
    <WorkspacePage>
      {!selected ? (
        <PageHeader
          family="article"
          title={t.title}
          sub={t.sub}
          action={articles.length === 0 ? createArticle : null}
        />
      ) : null}

      {articles.length === 0 ? (
        <Card>
          <CardContent className="text-copy-muted py-12 text-center text-sm">
            {t.empty}
          </CardContent>
        </Card>
      ) : !selected ? (
        <>
          <StatGrid>
            <Stat label={t["list.totalArticles"]} value={articles.length} />
            <Stat
              label={t["list.publishedArticles"]}
              value={publishedArticleCount}
            />
            <Stat
              label={t["list.attentionArticles"]}
              value={attentionArticleCount}
            />
          </StatGrid>

          <ArticlesTable
            rows={tableRows}
            locale={locale}
            labels={tableLabels}
            createAction={createArticle}
          />
        </>
      ) : detail && languageAbilities ? (
        <div className="min-w-0 space-y-5">
          <Button
            variant="ghost"
            nativeButton={false}
            render={
              <Link href={localizedPath("/dashboard/articles", locale)} />
            }
          >
            <ArrowLeft aria-hidden />
            {t["create.back"]}
          </Button>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <FileText className="size-5 shrink-0" aria-hidden />
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
                <ArticleWorkflowBar
                  locale={locale}
                  entryId={selected.id}
                  sourceLanguage={detail.sourceLanguage}
                  languages={detail.languages}
                  workflowState={selected.displayState}
                  archived={selected.archivedAt !== null}
                  canArchive={
                    mayEdit(selected.authorId) && !selected.hasPublication
                  }
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
                <span>
                  {t["overview.owner"]}:{" "}
                  <span className="text-ink font-medium">
                    {selected.ownerName ?? t["scope.platform"]}
                  </span>
                </span>
                <span>
                  {t["overview.sourceLanguage"]}:{" "}
                  <span className="text-ink font-medium">
                    {t[`language.${detail.sourceLanguage}` as keyof typeof t]}
                  </span>
                </span>
                {selected.articleDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" aria-hidden />
                    {localeDate(selected.articleDate, locale)}
                  </span>
                ) : null}
              </div>
              {detail.canBecomeOutdated && detail.unreliableFrom ? (
                <div className="border-warn/50 bg-warn-soft text-warn flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  {t["freshness.warning"].replace(
                    "{date}",
                    localeDate(detail.unreliableFrom, locale),
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Match the activity editor: authored text and record details stay
           * on the left; translations, media and read-only context stay on the
           * right. The single Save action sits below the whole workspace. */}
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">{t["detail.content"]}</CardTitle>
            </CardHeader>
            <CardContent>
              <ArticleEditorForm
                key={`${selected.id}-${String(detail.revisionNumber)}-${detail.contentKey}`}
                formId={articleFormId}
                locale={locale}
                entryId={selected.id}
                organizationId={selected.organizationId ?? undefined}
                sourceLanguage={detail.sourceLanguage}
                articleDate={selected.articleDate}
                featured={selected.featured}
                tags={detail.tags}
                initialTagIds={detail.selectedTagIds}
                languages={detail.languages}
                archived={selected.archivedAt !== null}
                abilities={languageAbilities}
                aiEnabled={hasAiTranslationProvider()}
                canVerify={canVerifyTranslations}
                returnPath={localizedPath("/dashboard/articles", locale, {
                  article: selected.id,
                })}
                details={
                  <div className="@xl:grid-cols-2 grid min-w-0 items-start gap-4">
                    <div className="grid min-w-0 content-start gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {t["detail.sources"]}
                          </CardTitle>
                          <CardDescription>{t["source.hint"]}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ArticleSources
                            key={selected.id}
                            locale={locale}
                            entryId={selected.id}
                            sources={detail.sourceList}
                            labels={t}
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {shared["steward.title"]}
                          </CardTitle>
                          <CardDescription>
                            {shared["steward.hint"]}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <StewardContactForm
                            key={selected.id}
                            action={updateEditorialSteward}
                            locale={locale}
                            recordId={selected.id}
                            values={selected}
                            members={stewardCandidates}
                            labels={shared}
                            embedded
                            formId={articleFormId}
                          />
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {t["detail.freshness"]}
                        </CardTitle>
                        <CardDescription>
                          {t["freshness.question"]}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ArticleFreshnessForm
                          key={selected.id}
                          locale={locale}
                          entryId={selected.id}
                          canBecomeOutdated={detail.canBecomeOutdated}
                          unreliableFrom={detail.unreliableFrom}
                          sourceSummary={detail.sourceSummary}
                          labels={t}
                          embedded
                          formId={articleFormId}
                        />
                      </CardContent>
                    </Card>
                  </div>
                }
                media={
                  <div className="grid gap-5">
                    <Card>
                      <CardHeader className="border-b">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <FileImage
                                className="size-4 shrink-0"
                                aria-hidden
                              />
                              {t["image.heading"]}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {t["image.hint"]}
                            </CardDescription>
                          </div>
                          <ArticleDownloadsManager
                            key={`${selected.id}-${String(detail.downloads.length)}`}
                            locale={locale}
                            entryId={selected.id}
                            sourceLanguage={detail.sourceLanguage}
                            downloads={detail.downloads}
                            labels={t}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ArticleMediaManager
                          key={`${selected.id}-${detail.cover?.assetId ?? "none"}`}
                          locale={locale}
                          entryId={selected.id}
                          sourceLanguage={detail.sourceLanguage}
                          cover={detail.cover}
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
                  save: shared["console.save"],
                  saved: shared["console.saved"],
                  saveError: shared["form.saveFailed"],
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
