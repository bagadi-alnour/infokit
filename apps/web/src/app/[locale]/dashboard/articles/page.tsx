import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileText,
  Plus,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import type { ArticleContentValue } from "~/components/admin/article-content-fields";
import { ArticleMediaManager } from "~/components/admin/article-media-manager";
import {
  ArticleEditorForm,
  ArticleFreshnessForm,
  ArticlePublication,
  ArticleSources,
  ArticleWorkflowBar,
  type ArticleLanguageStatus,
  type ArticleSource,
} from "~/components/admin/article-manage";
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
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { ScrollArea } from "~/components/ui/scroll-area";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  editorialLanguageCodes,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import { createAssetReadUrl } from "~/server/assets/s3";
import { db } from "~/server/db";
import {
  articleDetails,
  assets,
  assetTranslations,
  editorialCustodianships,
  editorialEntries,
  editorialEntryAssets,
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

function localeDateTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Paris",
  }).format(value);
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

const workflowStates = [
  "draft",
  "in_review",
  "published",
  "scheduled",
  "unpublished",
  "archived",
] as const;

export default async function ArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ article?: string; q?: string; status?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const search = await searchParams;
  const t = await loadPageCatalog(locale, "dashboard-articles");

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
    .where(eq(editorialEntries.kind, "article"))
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

  const verifierIds = [
    ...new Set(
      translationRows.flatMap((translation) =>
        translation.verifiedById ? [translation.verifiedById] : [],
      ),
    ),
  ];
  const verifierRows = verifierIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, verifierIds))
    : [];
  const verifierById = new Map(
    verifierRows.map((verifier) => [verifier.id, verifier]),
  );

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

  const articles = entryRows.map((entry) => {
    const activePublications = activePublicationsByEntry.get(entry.id) ?? [];
    const scheduledPublications =
      scheduledPublicationsByEntry.get(entry.id) ?? [];
    const displayState =
      entry.archivedAt !== null
        ? "archived"
        : activePublications.length > 0
          ? "published"
          : scheduledPublications.length > 0
            ? "scheduled"
            : entry.workflowState;
    return {
      ...entry,
      displayState,
      title: titleOf(entry.id),
      revisionNumber: latestRevisionByEntry.get(entry.id)?.revisionNumber ?? 1,
      publishedLanguages: activePublications.map(
        (publication) => publication.languageCode,
      ),
    };
  });

  const selected = search.article
    ? articles.find((article) => article.id === search.article)
    : undefined;
  const query = search.q?.trim().toLocaleLowerCase(locale) ?? "";
  const requestedStatus = workflowStates.includes(
    search.status as (typeof workflowStates)[number],
  )
    ? search.status
    : "";
  const filteredArticles = articles.filter((article) => {
    const matchesStatus =
      !requestedStatus || article.displayState === requestedStatus;
    const searchable =
      `${article.title} ${article.slug} ${article.ownerName ?? t["scope.platform"]}`.toLocaleLowerCase(
        locale,
      );
    return matchesStatus && (!query || searchable.includes(query));
  });
  const publishedArticleCount = articles.filter(
    (article) => article.displayState === "published",
  ).length;
  const attentionArticleCount = articles.filter((article) =>
    ["draft", "in_review", "unpublished"].includes(article.displayState),
  ).length;

  // ---- Selected article detail -----------------------------------------
  let detail: {
    content: ArticleContentValue;
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

    const emptyLang = () => ({ title: "", summary: "", bodyHtml: "" });
    const content = Object.fromEntries(
      contentLanguages.map((language) => [language, emptyLang()]),
    ) as ArticleContentValue;
    for (const translation of translations) {
      if (
        !contentLanguages.includes(translation.languageCode as ContentLanguage)
      )
        continue;
      const code = translation.languageCode as ContentLanguage;
      content[code] = {
        title: translation.title,
        summary: translation.summary ?? "",
        bodyHtml: bodyHtmlOf(translation.bodyJson),
      };
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
        title: translation?.title ?? null,
        summary: translation?.summary ?? null,
        bodyHtml: translation ? bodyHtmlOf(translation.bodyJson) : null,
        state: translation?.state ?? "draft",
        method: translation?.method ?? "human",
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
          ? (verifierById.get(translation.verifiedById) ?? null)
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
      content,
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
            previewUrl: await createAssetReadUrl(coverRows[0].storageKey),
            altText: coverRows[0].altText ?? t["image.attached"],
          }
        : null,
    };
  }

  return (
    <div className="px-4 py-7 md:px-7 lg:px-8">
      {!selected ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
            <p className="text-copy-muted mt-2 max-w-3xl text-sm">{t.sub}</p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href={localizedPath("/dashboard/articles/new", locale)} />
            }
          >
            <Plus aria-hidden />
            {t["create.cta"]}
          </Button>
        </div>
      ) : null}

      {articles.length === 0 ? (
        <Card>
          <CardContent className="text-copy-muted py-12 text-center text-sm">
            {t.empty}
          </CardContent>
        </Card>
      ) : !selected ? (
        <section className="grid gap-5">
          <dl className="border-line bg-surface grid overflow-hidden rounded-xl border sm:grid-cols-3">
            {[
              [t["list.totalArticles"], articles.length],
              [t["list.publishedArticles"], publishedArticleCount],
              [t["list.attentionArticles"], attentionArticleCount],
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
            action={localizedPath("/dashboard/articles", locale)}
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
            <NativeSelect
              name="status"
              defaultValue={requestedStatus}
              aria-label={t["list.filterState"]}
            >
              <NativeSelectOption value="">
                {t["list.allStates"]}
              </NativeSelectOption>
              {workflowStates.map((state) => (
                <NativeSelectOption key={state} value={state}>
                  {t[`state.${state}`]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button type="submit">
              <Search aria-hidden />
              {t["list.applyFilters"]}
            </Button>
          </form>

          <div className="border-line bg-surface overflow-hidden rounded-xl border">
            <div className="border-line bg-subtle text-copy-muted hidden grid-cols-[minmax(16rem,2fr)_minmax(9rem,1fr)_8rem_minmax(10rem,1fr)_9rem_2rem] gap-4 border-b px-5 py-3 text-xs font-medium md:grid">
              <span>{t["list.articleColumn"]}</span>
              <span>{t["list.ownerColumn"]}</span>
              <span>{t["list.statusColumn"]}</span>
              <span>{t["list.languagesColumn"]}</span>
              <span>{t["list.updatedColumn"]}</span>
              <span aria-hidden />
            </div>
            {filteredArticles.length > 0 ? (
              <nav aria-label={t.title} className="divide-line divide-y">
                {filteredArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`${localizedPath("/dashboard/articles", locale)}?article=${article.id}`}
                    aria-label={t["list.open"].replace(
                      "{title}",
                      article.title,
                    )}
                    className="hover:bg-subtle focus-visible:ring-ring grid gap-4 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset md:grid-cols-[minmax(16rem,2fr)_minmax(9rem,1fr)_8rem_minmax(10rem,1fr)_9rem_2rem] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">
                          {article.title}
                        </span>
                        {article.featured ? (
                          <Sparkles
                            className="text-brand size-3.5 shrink-0"
                            aria-label={t["list.featured"]}
                          />
                        ) : null}
                      </div>
                      <p className="text-copy-muted mt-1 truncate text-xs">
                        /{article.slug} ·{" "}
                        {t["overview.revision"].replace(
                          "{n}",
                          String(article.revisionNumber),
                        )}
                      </p>
                    </div>
                    <p className="text-copy-muted min-w-0 truncate text-sm">
                      <span className="mb-1 block text-xs font-medium md:hidden">
                        {t["list.ownerColumn"]}
                      </span>
                      {article.ownerName ?? t["scope.platform"]}
                    </p>
                    <div>
                      <span className="text-copy-muted mb-1 block text-xs font-medium md:hidden">
                        {t["list.statusColumn"]}
                      </span>
                      <Badge
                        variant={
                          workflowBadge[article.displayState] ?? "outline"
                        }
                      >
                        {t[`state.${article.displayState}` as keyof typeof t]}
                      </Badge>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      <span className="text-copy-muted mb-0.5 block w-full text-xs font-medium md:hidden">
                        {t["list.languagesColumn"]}
                      </span>
                      {article.publishedLanguages.length > 0
                        ? article.publishedLanguages.map((language) => (
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
                      dateTime={article.updatedAt.toISOString()}
                      className="text-copy-muted text-sm tabular-nums"
                    >
                      <span className="mb-1 block text-xs font-medium md:hidden">
                        {t["list.updatedColumn"]}
                      </span>
                      {localeDate(article.updatedAt, locale)}
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
      ) : detail ? (
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
                  workflowState={selected.displayState}
                  archived={selected.archivedAt !== null}
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

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-5 xl:col-start-2 xl:row-start-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t["image.heading"]}
                  </CardTitle>
                  <CardDescription>{t["image.hint"]}</CardDescription>
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
                    {t["detail.publication"]}
                  </CardTitle>
                  <CardDescription>{t["translation.heading"]}</CardDescription>
                </CardHeader>
                <CardContent className="pe-2">
                  <ScrollArea
                    className="h-[34rem] pe-3"
                    aria-label={t["detail.publication"]}
                  >
                    <ArticlePublication
                      key={selected.id}
                      locale={locale}
                      entryId={selected.id}
                      sourceLanguage={detail.sourceLanguage}
                      languages={detail.languages}
                      archived={selected.archivedAt !== null}
                      labels={t}
                      compact
                    />
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t["detail.freshness"]}
                  </CardTitle>
                  <CardDescription>{t["freshness.question"]}</CardDescription>
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
                  {detail.history.length === 0 ? (
                    <p className="text-copy-muted text-sm">
                      {t["history.empty"]}
                    </p>
                  ) : (
                    <ScrollArea
                      className="h-56 pe-3"
                      aria-label={t["detail.history"]}
                    >
                      <ol className="border-line grid gap-0 border-s ps-4">
                        {detail.history.map((item) => (
                          <li
                            key={item.key}
                            className="relative pb-4 last:pb-0"
                          >
                            <span className="bg-brand absolute -start-[1.3rem] top-1 size-2 rounded-full" />
                            <p className="text-sm font-medium">{item.label}</p>
                            <time
                              dateTime={item.at.toISOString()}
                              className="text-copy-muted mt-1 block text-xs tabular-nums"
                            >
                              {localeDateTime(item.at, locale)}
                            </time>
                            {item.by ? (
                              <p className="text-copy-muted mt-0.5 text-xs">
                                {t["history.by"].replace("{name}", item.by)}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid min-w-0 gap-5 xl:col-start-1 xl:row-start-1">
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t["detail.content"]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ArticleEditorForm
                    key={`${selected.id}-${String(detail.revisionNumber)}-${detail.contentKey}`}
                    locale={locale}
                    entryId={selected.id}
                    sourceLanguage={detail.sourceLanguage}
                    articleDate={selected.articleDate}
                    featured={selected.featured}
                    tags={detail.tags}
                    initialTagIds={detail.selectedTagIds}
                    content={detail.content}
                    labels={t}
                  />
                </CardContent>
              </Card>

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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
