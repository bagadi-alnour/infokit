"use server";

import type { Locale } from "@infokit/shared/i18n";
import { and, desc, eq, inArray, isNull, lte, max, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { verifyAssetUpload } from "~/server/assets/s3";
import { auth } from "~/server/auth";
import {
  protectedPermissionAction,
  requirePermission,
} from "~/server/auth/require";
import {
  editorialLanguages,
  hashContent,
  localizedContentHash,
  slugify,
  type LocalizedContent,
  type SourceContent,
} from "~/server/content/editorial";
import { parseScheduledPublication } from "~/server/content/publication-schedule";
import { sanitizeRichText } from "~/server/content/sanitize-rich-text";
import { db } from "~/server/db";
import {
  articleDetails,
  assets,
  editorialCustodianships,
  editorialEntries,
  editorialEntryAssets,
  editorialEntryRoutes,
  editorialEntryTags,
  editorialPublications,
  editorialRevisions,
  editorialRevisionSources,
  editorialRevisionTranslations,
  languages as languageCatalog,
  sources,
  tags,
  translationSourceVersions,
} from "~/server/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const optional = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

const languageSchema = z.enum(editorialLanguages);
const publicationModeSchema = z.enum(["draft", "now", "scheduled"]);

function refresh(locale: Locale) {
  revalidatePath(localizedPath("/dashboard", locale));
  revalidatePath(localizedPath("/dashboard/articles", locale));
}

/* ---------------------------------------------------------------- */
/* Shared payload assembly                                          */
/* ---------------------------------------------------------------- */

interface AuthoredTranslation {
  languageCode: string;
  title: string;
  summary: string | null;
  bodyHtml: string | null;
  plainText: string | null;
}

/** Read one text field as a trimmed string, ignoring File entries. */
function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Collect the per-language fields the article forms submit. */
function readTranslations(formData: FormData): AuthoredTranslation[] {
  const result: AuthoredTranslation[] = [];
  for (const language of editorialLanguages) {
    const upper = language.toUpperCase();
    const title = field(formData, `title${upper}`);
    if (!title) continue;
    const summary = field(formData, `summary${upper}`);
    const body = sanitizeRichText(field(formData, `body${upper}Html`));
    result.push({
      languageCode: language,
      title: title.slice(0, 200),
      summary: summary === "" ? null : summary,
      bodyHtml: body.html,
      plainText: body.text,
    });
  }
  return result;
}

function toLocalized(translation: AuthoredTranslation): LocalizedContent {
  return {
    title: translation.title,
    summary: translation.summary,
    bodyHtml: translation.bodyHtml,
    plainText: translation.plainText,
  };
}

/** A revision is sealed once any publication (active or historical) cites it. */
async function isRevisionSealed(tx: Tx, revisionId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: editorialPublications.id })
    .from(editorialPublications)
    .where(eq(editorialPublications.revisionId, revisionId))
    .limit(1);
  return Boolean(row);
}

/**
 * Rebuild the immutable source version for one revision from its current
 * translations. In-place for an unsealed revision (version stays), or a fresh
 * successor version when the revision was created because its predecessor is
 * sealed.
 */
async function writeSourceVersion(
  tx: Tx,
  input: {
    entryId: string;
    organizationId: string | null;
    revisionId: string;
    sourceLanguageCode: string;
    articleDate: string | null;
    translations: AuthoredTranslation[];
    createdById: string | null;
    isNewRevision: boolean;
    previousVersionId: string | null;
  },
): Promise<string> {
  const sourceContent: SourceContent = {
    sourceLanguage: input.sourceLanguageCode,
    articleDate: input.articleDate,
    translations: Object.fromEntries(
      input.translations.map((translation) => [
        translation.languageCode,
        toLocalized(translation),
      ]),
    ),
  };
  const sourceContentHash = hashContent(sourceContent);

  if (!input.isNewRevision) {
    const [existing] = await tx
      .select({ id: translationSourceVersions.id })
      .from(translationSourceVersions)
      .where(eq(translationSourceVersions.sourceRevisionId, input.revisionId))
      .limit(1);
    if (existing) {
      await tx
        .update(translationSourceVersions)
        .set({ sourceContentJson: sourceContent, sourceContentHash })
        .where(eq(translationSourceVersions.id, existing.id));
      return existing.id;
    }
  }

  const [{ value: maxVersion } = { value: 0 }] = await tx
    .select({ value: max(translationSourceVersions.version) })
    .from(translationSourceVersions)
    .where(
      and(
        eq(translationSourceVersions.entityKind, "editorial_entry"),
        eq(translationSourceVersions.entityId, input.entryId),
      ),
    );
  const nextVersion = (maxVersion ?? 0) + 1;
  const [created] = await tx
    .insert(translationSourceVersions)
    .values({
      organizationId: input.organizationId,
      entityKind: "editorial_entry",
      entityId: input.entryId,
      version: nextVersion,
      previousVersionId: nextVersion === 1 ? null : input.previousVersionId,
      sourceRevisionId: input.revisionId,
      sourceLanguageCode: input.sourceLanguageCode,
      sourceContentJson: sourceContent,
      sourceContentHash,
      impact: nextVersion === 1 ? "initial" : "review_required",
      createdById: input.createdById,
    })
    .returning({ id: translationSourceVersions.id });
  if (!created) throw new Error("Source version insert returned no row");
  return created.id;
}

/** Write (upsert) the per-language translation rows for one revision. */
async function writeTranslations(
  tx: Tx,
  revisionId: string,
  sourceVersionId: string,
  translations: AuthoredTranslation[],
) {
  for (const translation of translations) {
    await tx
      .insert(editorialRevisionTranslations)
      .values({
        revisionId,
        languageCode: translation.languageCode,
        title: translation.title,
        summary: translation.summary,
        bodyJson: translation.bodyHtml ? { html: translation.bodyHtml } : null,
        plainText: translation.plainText,
        state: "draft",
        method: "human",
        sourceVersionId,
        contentHash: localizedContentHash(
          translation.languageCode,
          toLocalized(translation),
        ),
      })
      .onConflictDoUpdate({
        target: [
          editorialRevisionTranslations.revisionId,
          editorialRevisionTranslations.languageCode,
        ],
        set: {
          title: translation.title,
          summary: translation.summary,
          bodyJson: translation.bodyHtml
            ? { html: translation.bodyHtml }
            : null,
          plainText: translation.plainText,
          sourceVersionId,
          contentHash: localizedContentHash(
            translation.languageCode,
            toLocalized(translation),
          ),
        },
      });
  }
}

/* ---------------------------------------------------------------- */
/* Create                                                           */
/* ---------------------------------------------------------------- */

const createSchema = z.object({
  organizationId: optional.pipe(z.string().uuid().nullable()),
  scope: z.enum(["global", "city"]),
  cityId: optional.pipe(z.string().uuid().nullable()),
  slug: optional,
  tagIds: z.array(z.string().uuid()).max(3),
  coverAssetId: optional.pipe(z.string().uuid().nullable()),
  sourceLanguage: languageSchema,
  articleDate: optional,
  featured: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  canBecomeOutdated: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  unreliableFrom: optional,
  sourceSummary: optional,
  publicationMode: publicationModeSchema.default("draft"),
  publishAt: optional,
});

async function uniqueSlug(tx: Tx, desired: string): Promise<string> {
  let candidate = slugify(desired);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [taken] = await tx
      .select({ id: editorialEntries.id })
      .from(editorialEntries)
      .where(eq(editorialEntries.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
    const suffix = Math.floor(attempt * 7 + 11).toString(36);
    candidate = `${slugify(desired).slice(0, 140)}-${suffix}`;
  }
  return `${slugify(desired).slice(0, 130)}-${Date.now().toString(36)}`;
}

async function uniqueLocalizedSlug(
  tx: Tx,
  languageCode: string,
  desired: string,
): Promise<string> {
  const base = slugify(desired);
  let candidate = base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [taken] = await tx
      .select({ id: editorialEntryRoutes.id })
      .from(editorialEntryRoutes)
      .where(
        and(
          eq(editorialEntryRoutes.languageCode, languageCode),
          eq(editorialEntryRoutes.slug, candidate),
        ),
      )
      .limit(1);
    if (!taken) return candidate;
    candidate = `${base.slice(0, 140)}-${String(attempt + 2)}`;
  }
  return `${base.slice(0, 130)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function validateArticleTags(
  tx: Tx,
  tagIds: string[],
  organizationId: string | null,
): Promise<string[]> {
  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length === 0) return [];

  const allowedTags = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(
      and(
        inArray(tags.id, uniqueTagIds),
        eq(tags.active, true),
        eq(tags.visibility, "public"),
        organizationId
          ? or(
              isNull(tags.organizationId),
              eq(tags.organizationId, organizationId),
            )
          : isNull(tags.organizationId),
      ),
    );
  const allowedTagIds = new Set(allowedTags.map((tag) => tag.id));
  if (allowedTagIds.size !== uniqueTagIds.length) {
    throw new Error("One or more tags are unavailable in this scope");
  }
  return uniqueTagIds;
}

export const createArticle = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    const parsed = createSchema.parse({
      organizationId: formData.get("organizationId") ?? "",
      scope: formData.get("scope"),
      cityId: formData.get("cityId") ?? "",
      slug: formData.get("slug") ?? "",
      tagIds: formData.getAll("tagIds"),
      coverAssetId: formData.get("coverAssetId") ?? "",
      sourceLanguage: formData.get("sourceLanguage"),
      articleDate: formData.get("articleDate") ?? "",
      featured: formData.get("featured") ?? "",
      canBecomeOutdated: formData.get("canBecomeOutdated") ?? "",
      unreliableFrom: formData.get("unreliableFrom") ?? "",
      sourceSummary: formData.get("sourceSummary") ?? "",
      publicationMode: formData.get("publicationMode") ?? "draft",
      publishAt: formData.get("publishAt") ?? "",
    });
    const scheduledFor = parseScheduledPublication(
      parsed.publicationMode,
      parsed.publishAt,
    );
    const translations = readTranslations(formData);
    const sourceTranslation = translations.find(
      (translation) => translation.languageCode === parsed.sourceLanguage,
    );
    if (!sourceTranslation) {
      throw new Error("The source language needs a title");
    }
    if (parsed.canBecomeOutdated && !parsed.unreliableFrom) {
      throw new Error("A reliability date is required when content can age");
    }
    if (parsed.scope === "city" && !parsed.cityId) {
      throw new Error("A city-scoped article requires a city");
    }
    const session = await auth();
    const authorId = session?.user.id;
    if (!authorId) throw new Error("A signed-in author is required");
    if (parsed.publicationMode !== "draft") {
      await requirePermission(
        "content.article.publish",
        locale,
        parsed.organizationId ?? undefined,
      );
    }

    if (parsed.coverAssetId) {
      const [uploadedCover] = await db
        .select({
          storageKey: assets.storageKey,
          mimeType: assets.mimeType,
          byteSize: assets.byteSize,
        })
        .from(assets)
        .where(
          and(
            eq(assets.id, parsed.coverAssetId),
            eq(assets.uploaderId, authorId),
            eq(assets.kind, "image"),
            eq(assets.rightsConfirmed, true),
            isNull(assets.archivedAt),
          ),
        )
        .limit(1);
      if (!uploadedCover) throw new Error("The cover image is unavailable");
      await verifyAssetUpload(uploadedCover);
    }

    const entry = await db.transaction(async (tx) => {
      const slug = await uniqueSlug(tx, parsed.slug ?? sourceTranslation.title);
      const [createdEntry] = await tx
        .insert(editorialEntries)
        .values({
          kind: "article",
          slug,
          workflowState: "draft",
          cityId: parsed.scope === "city" ? parsed.cityId : null,
        })
        .returning({ id: editorialEntries.id });
      if (!createdEntry) throw new Error("Article insert returned no row");

      const localizedSlug = await uniqueLocalizedSlug(
        tx,
        parsed.sourceLanguage,
        parsed.slug ?? sourceTranslation.title,
      );
      await tx.insert(editorialEntryRoutes).values({
        entryId: createdEntry.id,
        languageCode: parsed.sourceLanguage,
        slug: localizedSlug,
      });

      await tx.insert(articleDetails).values({
        entryId: createdEntry.id,
        articleDate: parsed.articleDate,
        featured: parsed.featured,
      });

      const [revision] = await tx
        .insert(editorialRevisions)
        .values({
          entryId: createdEntry.id,
          revisionNumber: 1,
          authorId,
          sourceLanguageCode: parsed.sourceLanguage,
          canBecomeOutdated: parsed.canBecomeOutdated,
          unreliableFrom: parsed.canBecomeOutdated
            ? parsed.unreliableFrom
            : null,
          sourceSummary: parsed.sourceSummary,
        })
        .returning({ id: editorialRevisions.id });
      if (!revision) throw new Error("Revision insert returned no row");

      const sourceVersionId = await writeSourceVersion(tx, {
        entryId: createdEntry.id,
        organizationId: parsed.organizationId,
        revisionId: revision.id,
        sourceLanguageCode: parsed.sourceLanguage,
        articleDate: parsed.articleDate,
        translations,
        createdById: authorId,
        isNewRevision: false,
        previousVersionId: null,
      });
      await writeTranslations(tx, revision.id, sourceVersionId, translations);

      await tx.insert(editorialCustodianships).values({
        entryId: createdEntry.id,
        custodianKind: parsed.organizationId ? "organization" : "platform",
        organizationId: parsed.organizationId,
        actorUserId: authorId,
      });

      const tagIds = await validateArticleTags(
        tx,
        parsed.tagIds,
        parsed.organizationId,
      );
      if (tagIds.length > 0) {
        await tx.insert(editorialEntryTags).values(
          tagIds.map((tagId, index) => ({
            entryId: createdEntry.id,
            tagId,
            displayOrder: index,
          })),
        );
      }

      if (parsed.coverAssetId) {
        const [cover] = await tx
          .select({ id: assets.id })
          .from(assets)
          .where(
            and(
              eq(assets.id, parsed.coverAssetId),
              eq(assets.uploaderId, authorId),
              eq(assets.kind, "image"),
              eq(assets.rightsConfirmed, true),
              isNull(assets.archivedAt),
            ),
          )
          .limit(1);
        if (!cover) throw new Error("The cover image is unavailable");
        await tx.insert(editorialEntryAssets).values({
          entryId: createdEntry.id,
          assetId: cover.id,
          role: "cover",
        });
      }

      if (parsed.publicationMode !== "draft") {
        await tx.insert(editorialPublications).values({
          entryId: createdEntry.id,
          languageCode: parsed.sourceLanguage,
          revisionId: revision.id,
          sourceVersionId,
          translationContentHash: localizedContentHash(
            parsed.sourceLanguage,
            toLocalized(sourceTranslation),
          ),
          publishedById: authorId,
          scheduledFor,
        });
        await tx
          .update(editorialRevisionTranslations)
          .set({
            state: "verified",
            verifiedById: authorId,
            verifiedAt: new Date(),
          })
          .where(
            and(
              eq(editorialRevisionTranslations.revisionId, revision.id),
              eq(
                editorialRevisionTranslations.languageCode,
                parsed.sourceLanguage,
              ),
            ),
          );
        if (!scheduledFor) {
          await tx
            .update(editorialEntries)
            .set({ workflowState: "published", updatedAt: new Date() })
            .where(eq(editorialEntries.id, createdEntry.id));
          if (parsed.coverAssetId) {
            await tx
              .update(assets)
              .set({ visibility: "public", updatedAt: new Date() })
              .where(eq(assets.id, parsed.coverAssetId));
          }
        }
      }

      return { id: createdEntry.id };
    });

    await recordAudit({
      action: "article.created",
      subjectType: "editorial_entry",
      subjectId: entry.id,
      organizationId: parsed.organizationId,
      metadata: {
        sourceLanguage: parsed.sourceLanguage,
        publicationMode: parsed.publicationMode,
        scheduledFor: scheduledFor?.toISOString() ?? null,
      },
    });
    if (parsed.publicationMode !== "draft") {
      await recordAudit({
        action: scheduledFor
          ? "article.language_scheduled"
          : "article.language_published",
        subjectType: "editorial_entry",
        subjectId: entry.id,
        organizationId: parsed.organizationId,
        metadata: {
          languageCode: parsed.sourceLanguage,
          scheduledFor: scheduledFor?.toISOString() ?? null,
        },
      });
    }
    refresh(locale);
    redirect(
      `${localizedPath("/dashboard/articles", locale)}?article=${entry.id}`,
    );
  },
);

/* ---------------------------------------------------------------- */
/* Edit content (upsert translations onto the editable revision)    */
/* ---------------------------------------------------------------- */

const saveSchema = z.object({
  entryId: z.string().uuid(),
  articleDate: optional,
  tagIds: z.array(z.string().uuid()).max(3),
  featured: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
});

export const saveArticleContent = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    const parsed = saveSchema.parse({
      entryId: formData.get("entryId"),
      articleDate: formData.get("articleDate") ?? "",
      tagIds: formData.getAll("tagIds"),
      featured: formData.get("featured") ?? "",
    });
    const translations = readTranslations(formData);
    if (translations.length === 0) {
      throw new Error("At least the source language must keep a title");
    }
    const session = await auth();
    const authorId = session?.user.id ?? null;

    await db.transaction(async (tx) => {
      const [entry] = await tx
        .select({
          id: editorialEntries.id,
          workflowState: editorialEntries.workflowState,
        })
        .from(editorialEntries)
        .where(eq(editorialEntries.id, parsed.entryId));
      if (!entry) throw new Error("Unknown article");

      const [latest] = await tx
        .select()
        .from(editorialRevisions)
        .where(eq(editorialRevisions.entryId, parsed.entryId))
        .orderBy(desc(editorialRevisions.revisionNumber))
        .limit(1);
      if (!latest) throw new Error("Article has no revision");

      const [custodian] = await tx
        .select({ organizationId: editorialCustodianships.organizationId })
        .from(editorialCustodianships)
        .where(
          and(
            eq(editorialCustodianships.entryId, parsed.entryId),
            isNull(editorialCustodianships.endedAt),
          ),
        );

      const sealed = await isRevisionSealed(tx, latest.id);
      let revisionId = latest.id;
      let isNewRevision = false;
      let previousSourceVersionId: string | null = null;

      if (sealed) {
        const [prevSource] = await tx
          .select({ id: translationSourceVersions.id })
          .from(translationSourceVersions)
          .where(eq(translationSourceVersions.sourceRevisionId, latest.id))
          .limit(1);
        previousSourceVersionId = prevSource?.id ?? null;
        const [created] = await tx
          .insert(editorialRevisions)
          .values({
            entryId: parsed.entryId,
            revisionNumber: latest.revisionNumber + 1,
            authorId,
            sourceLanguageCode: latest.sourceLanguageCode,
            canBecomeOutdated: latest.canBecomeOutdated,
            unreliableFrom: latest.unreliableFrom,
            sourceSummary: latest.sourceSummary,
          })
          .returning({ id: editorialRevisions.id });
        if (!created) throw new Error("Revision insert returned no row");
        revisionId = created.id;
        isNewRevision = true;
      }

      const sourceVersionId = await writeSourceVersion(tx, {
        entryId: parsed.entryId,
        organizationId: custodian?.organizationId ?? null,
        revisionId,
        sourceLanguageCode: latest.sourceLanguageCode,
        articleDate: parsed.articleDate,
        translations,
        createdById: authorId,
        isNewRevision,
        previousVersionId: previousSourceVersionId,
      });
      await writeTranslations(tx, revisionId, sourceVersionId, translations);

      for (const translation of translations) {
        const [route] = await tx
          .select({ id: editorialEntryRoutes.id })
          .from(editorialEntryRoutes)
          .where(
            and(
              eq(editorialEntryRoutes.entryId, parsed.entryId),
              eq(editorialEntryRoutes.languageCode, translation.languageCode),
              isNull(editorialEntryRoutes.retiredAt),
            ),
          )
          .limit(1);
        if (!route) {
          await tx.insert(editorialEntryRoutes).values({
            entryId: parsed.entryId,
            languageCode: translation.languageCode,
            slug: await uniqueLocalizedSlug(
              tx,
              translation.languageCode,
              translation.title,
            ),
          });
        }
      }

      await tx
        .update(articleDetails)
        .set({ articleDate: parsed.articleDate, featured: parsed.featured })
        .where(eq(articleDetails.entryId, parsed.entryId));

      const tagIds = await validateArticleTags(
        tx,
        parsed.tagIds,
        custodian?.organizationId ?? null,
      );
      await tx
        .delete(editorialEntryTags)
        .where(eq(editorialEntryTags.entryId, parsed.entryId));
      if (tagIds.length > 0) {
        await tx.insert(editorialEntryTags).values(
          tagIds.map((tagId, index) => ({
            entryId: parsed.entryId,
            tagId,
            displayOrder: index,
          })),
        );
      }
      await tx
        .update(editorialEntries)
        .set({ updatedAt: new Date() })
        .where(eq(editorialEntries.id, parsed.entryId));
    });

    await recordAudit({
      action: "article.content_saved",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    refresh(locale);
  },
);

/* ---------------------------------------------------------------- */
/* Freshness (edited in place — metadata, not sealed content)       */
/* ---------------------------------------------------------------- */

const freshnessSchema = z.object({
  entryId: z.string().uuid(),
  canBecomeOutdated: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  unreliableFrom: optional,
  sourceSummary: optional,
});

export const updateArticleFreshness = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    const parsed = freshnessSchema.parse({
      entryId: formData.get("entryId"),
      canBecomeOutdated: formData.get("canBecomeOutdated") ?? "",
      unreliableFrom: formData.get("unreliableFrom") ?? "",
      sourceSummary: formData.get("sourceSummary") ?? "",
    });
    if (parsed.canBecomeOutdated && !parsed.unreliableFrom) {
      throw new Error("A reliability date is required when content can age");
    }
    const [latest] = await db
      .select({ id: editorialRevisions.id })
      .from(editorialRevisions)
      .where(eq(editorialRevisions.entryId, parsed.entryId))
      .orderBy(desc(editorialRevisions.revisionNumber))
      .limit(1);
    if (!latest) throw new Error("Article has no revision");
    await db
      .update(editorialRevisions)
      .set({
        canBecomeOutdated: parsed.canBecomeOutdated,
        unreliableFrom: parsed.canBecomeOutdated ? parsed.unreliableFrom : null,
        sourceSummary: parsed.sourceSummary,
      })
      .where(eq(editorialRevisions.id, latest.id));
    await recordAudit({
      action: "article.freshness_updated",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
      metadata: { canBecomeOutdated: parsed.canBecomeOutdated },
    });
    refresh(locale);
  },
);

/* ---------------------------------------------------------------- */
/* Workflow                                                         */
/* ---------------------------------------------------------------- */

const entrySchema = z.object({ entryId: z.string().uuid() });

export const submitArticleForReview = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    const parsed = entrySchema.parse({ entryId: formData.get("entryId") });
    await db
      .update(editorialEntries)
      .set({ workflowState: "in_review", updatedAt: new Date() })
      .where(
        and(
          eq(editorialEntries.id, parsed.entryId),
          eq(editorialEntries.workflowState, "draft"),
        ),
      );
    await recordAudit({
      action: "article.submitted_for_review",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    refresh(locale);
  },
);

const publishSchema = z.object({
  entryId: z.string().uuid(),
  languageCode: languageSchema,
  publishAt: optional,
});

export const publishArticleLanguage = protectedPermissionAction(
  "content.article.publish",
  async (formData, locale) => {
    const parsed = publishSchema.parse({
      entryId: formData.get("entryId"),
      languageCode: formData.get("languageCode"),
      publishAt: formData.get("publishAt") ?? "",
    });
    const scheduledFor = parsed.publishAt
      ? parseScheduledPublication("scheduled", parsed.publishAt)
      : null;
    const session = await auth();
    const publisherId = session?.user.id;
    if (!publisherId) throw new Error("A signed-in publisher is required");

    await db.transaction(async (tx) => {
      const [enabledLanguage] = await tx
        .select({ code: languageCatalog.code })
        .from(languageCatalog)
        .where(
          and(
            eq(languageCatalog.code, parsed.languageCode),
            eq(languageCatalog.enabled, true),
          ),
        )
        .limit(1);
      if (!enabledLanguage) {
        throw new Error("This language is not enabled for publication");
      }

      const [latest] = await tx
        .select({ id: editorialRevisions.id })
        .from(editorialRevisions)
        .where(eq(editorialRevisions.entryId, parsed.entryId))
        .orderBy(desc(editorialRevisions.revisionNumber))
        .limit(1);
      if (!latest) throw new Error("Article has no revision");

      const [translation] = await tx
        .select()
        .from(editorialRevisionTranslations)
        .where(
          and(
            eq(editorialRevisionTranslations.revisionId, latest.id),
            eq(editorialRevisionTranslations.languageCode, parsed.languageCode),
          ),
        );
      if (!translation?.title) {
        throw new Error("This language has no authored title to publish");
      }
      if (!translation.sourceVersionId) {
        throw new Error("This translation is not tied to a source version");
      }
      if (!translation.contentHash) {
        throw new Error("This translation has no content hash");
      }

      const attachedAssets = await tx
        .select({
          id: assets.id,
          scanState: assets.scanState,
          rightsConfirmed: assets.rightsConfirmed,
        })
        .from(editorialEntryAssets)
        .innerJoin(assets, eq(assets.id, editorialEntryAssets.assetId))
        .where(eq(editorialEntryAssets.entryId, parsed.entryId));
      if (
        attachedAssets.some(
          (asset) => !asset.rightsConfirmed || asset.scanState !== "clean",
        )
      ) {
        throw new Error(
          "Every attached image must pass safety and rights checks before publication",
        );
      }

      // Retire an existing active publication so the partial unique holds.
      await tx
        .update(editorialPublications)
        .set({ unpublishedAt: new Date(), unpublishedById: publisherId })
        .where(
          and(
            eq(editorialPublications.entryId, parsed.entryId),
            eq(editorialPublications.languageCode, parsed.languageCode),
            isNull(editorialPublications.unpublishedAt),
          ),
        );

      await tx.insert(editorialPublications).values({
        entryId: parsed.entryId,
        languageCode: parsed.languageCode,
        revisionId: latest.id,
        sourceVersionId: translation.sourceVersionId,
        translationContentHash: translation.contentHash,
        publishedById: publisherId,
        scheduledFor,
      });

      await tx
        .update(editorialRevisionTranslations)
        .set({
          state: "verified",
          verifiedById: publisherId,
          verifiedAt: new Date(),
        })
        .where(
          and(
            eq(editorialRevisionTranslations.revisionId, latest.id),
            eq(editorialRevisionTranslations.languageCode, parsed.languageCode),
          ),
        );

      await tx
        .update(editorialEntries)
        .set({
          ...(scheduledFor ? {} : { workflowState: "published" as const }),
          updatedAt: new Date(),
        })
        .where(eq(editorialEntries.id, parsed.entryId));

      if (!scheduledFor && attachedAssets.length > 0) {
        await tx
          .update(assets)
          .set({ visibility: "public", updatedAt: new Date() })
          .where(
            inArray(
              assets.id,
              attachedAssets.map((asset) => asset.id),
            ),
          );
      }
    });

    await recordAudit({
      action: scheduledFor
        ? "article.language_scheduled"
        : "article.language_published",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
      metadata: {
        languageCode: parsed.languageCode,
        scheduledFor: scheduledFor?.toISOString() ?? null,
      },
    });
    refresh(locale);
  },
);

export const unpublishArticleLanguage = protectedPermissionAction(
  "content.article.publish",
  async (formData, locale) => {
    const parsed = publishSchema.parse({
      entryId: formData.get("entryId"),
      languageCode: formData.get("languageCode"),
    });
    const session = await auth();
    const publisherId = session?.user.id;
    if (!publisherId) throw new Error("A signed-in publisher is required");

    await db.transaction(async (tx) => {
      await tx
        .update(editorialPublications)
        .set({ unpublishedAt: new Date(), unpublishedById: publisherId })
        .where(
          and(
            eq(editorialPublications.entryId, parsed.entryId),
            eq(editorialPublications.languageCode, parsed.languageCode),
            isNull(editorialPublications.unpublishedAt),
          ),
        );
      const [stillLive] = await tx
        .select({ id: editorialPublications.id })
        .from(editorialPublications)
        .where(
          and(
            eq(editorialPublications.entryId, parsed.entryId),
            isNull(editorialPublications.unpublishedAt),
            or(
              isNull(editorialPublications.scheduledFor),
              lte(editorialPublications.scheduledFor, new Date()),
            ),
          ),
        )
        .limit(1);
      if (!stillLive) {
        await tx
          .update(editorialEntries)
          .set({ workflowState: "unpublished", updatedAt: new Date() })
          .where(eq(editorialEntries.id, parsed.entryId));
      }
    });

    await recordAudit({
      action: "article.language_unpublished",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
      metadata: { languageCode: parsed.languageCode },
    });
    refresh(locale);
  },
);

export const archiveArticle = protectedPermissionAction(
  "content.article.publish",
  async (formData, locale) => {
    const parsed = entrySchema.parse({ entryId: formData.get("entryId") });
    const session = await auth();
    const publisherId = session?.user.id ?? null;
    await db.transaction(async (tx) => {
      await tx
        .update(editorialPublications)
        .set({ unpublishedAt: new Date(), unpublishedById: publisherId })
        .where(
          and(
            eq(editorialPublications.entryId, parsed.entryId),
            isNull(editorialPublications.unpublishedAt),
          ),
        );
      await tx
        .update(editorialEntries)
        .set({ workflowState: "archived", archivedAt: new Date() })
        .where(eq(editorialEntries.id, parsed.entryId));
    });
    await recordAudit({
      action: "article.archived",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    refresh(locale);
  },
);

export const restoreArticle = protectedPermissionAction(
  "content.article.publish",
  async (formData, locale) => {
    const parsed = entrySchema.parse({ entryId: formData.get("entryId") });
    await db
      .update(editorialEntries)
      .set({ workflowState: "draft", archivedAt: null, updatedAt: new Date() })
      .where(eq(editorialEntries.id, parsed.entryId));
    await recordAudit({
      action: "article.restored",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    refresh(locale);
  },
);

/* ---------------------------------------------------------------- */
/* Sources                                                          */
/* ---------------------------------------------------------------- */

const addSourceSchema = z.object({
  entryId: z.string().uuid(),
  title: z.string().trim().min(2).max(255),
  publisher: optional,
  url: optional.pipe(z.string().url().nullable()),
  sourceDate: optional,
});

export const addArticleSource = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    const parsed = addSourceSchema.parse({
      entryId: formData.get("entryId"),
      title: formData.get("title"),
      publisher: formData.get("publisher") ?? "",
      url: formData.get("url") ?? "",
      sourceDate: formData.get("sourceDate") ?? "",
    });
    const [latest] = await db
      .select({ id: editorialRevisions.id })
      .from(editorialRevisions)
      .where(eq(editorialRevisions.entryId, parsed.entryId))
      .orderBy(desc(editorialRevisions.revisionNumber))
      .limit(1);
    if (!latest) throw new Error("Article has no revision");
    await db.transaction(async (tx) => {
      const [source] = await tx
        .insert(sources)
        .values({
          title: parsed.title,
          publisher: parsed.publisher,
          url: parsed.url,
          sourceDate: parsed.sourceDate,
        })
        .returning({ id: sources.id });
      if (!source) throw new Error("Source insert returned no row");
      const [{ value: displayOrder } = { value: 0 }] = await tx
        .select({ value: max(editorialRevisionSources.displayOrder) })
        .from(editorialRevisionSources)
        .where(eq(editorialRevisionSources.revisionId, latest.id));
      await tx.insert(editorialRevisionSources).values({
        revisionId: latest.id,
        sourceId: source.id,
        displayOrder: (displayOrder ?? -1) + 1,
      });
    });
    await recordAudit({
      action: "article.source_added",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    refresh(locale);
  },
);

const removeSourceSchema = z.object({
  entryId: z.string().uuid(),
  sourceId: z.string().uuid(),
});

export const removeArticleSource = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    const parsed = removeSourceSchema.parse({
      entryId: formData.get("entryId"),
      sourceId: formData.get("sourceId"),
    });
    const [latest] = await db
      .select({ id: editorialRevisions.id })
      .from(editorialRevisions)
      .where(eq(editorialRevisions.entryId, parsed.entryId))
      .orderBy(desc(editorialRevisions.revisionNumber))
      .limit(1);
    if (!latest) throw new Error("Article has no revision");
    await db
      .delete(editorialRevisionSources)
      .where(
        and(
          eq(editorialRevisionSources.revisionId, latest.id),
          eq(editorialRevisionSources.sourceId, parsed.sourceId),
        ),
      );
    await recordAudit({
      action: "article.source_removed",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    refresh(locale);
  },
);
