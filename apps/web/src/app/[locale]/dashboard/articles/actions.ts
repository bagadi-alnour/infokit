"use server";

import type { Locale } from "@infokit/shared/i18n";
import { and, asc, desc, eq, inArray, isNull, lte, max, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { articleScopes } from "~/lib/article-scope";
import type { EditorialLanguage } from "~/lib/editorial-languages";
import { optionalText } from "~/lib/form-fields";
import { recordAudit } from "~/server/audit";
import { verifyAssetUpload } from "~/server/assets/s3";
import {
  hasActualPlatformPermission,
  superadminPermission,
} from "~/server/auth/authorization";
import {
  hasPermission,
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
import {
  clearedLanguageReview,
  platformCleared,
  platformVerifyPermission,
} from "~/server/content/language-review";
import {
  parseScheduledPublication,
  publishesOnSave,
  requestedReviewStage,
} from "~/server/content/publication-schedule";
import { sanitizeRichText } from "~/server/content/sanitize-rich-text";
import { db } from "~/server/db";
import { classifyTranslation } from "~/server/translation/provenance";
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

const languageSchema = z.enum(editorialLanguages);
const publicationModeSchema = z.enum([
  "draft",
  "team",
  "platform",
  "now",
  "scheduled",
]);

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
  /**
   * The signature a machine draft came back with, when this language was
   * generated in the browser during this editing session. Never trusted as a
   * claim — `writeTranslations` re-derives the hash and compares.
   */
  signature: string | null;
}

/**
 * What provenance is decided over: the two fields the generator signs. The
 * summary is deliberately out, because the generator does not produce one —
 * including it would report every machine draft as edited by a human.
 */
function provenancePayload(translation: AuthoredTranslation) {
  return { title: translation.title, bodyHtml: translation.bodyHtml };
}

/** The `{ html }` shape body text is stored in, back out as a string. */
function storedBodyHtml(bodyJson: unknown): string | null {
  if (bodyJson && typeof bodyJson === "object" && "html" in bodyJson) {
    const html = (bodyJson as { html?: unknown }).html;
    return typeof html === "string" ? html : null;
  }
  return null;
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
    const signature = field(formData, `translation_proposal_${language}`);
    result.push({
      languageCode: language,
      title: title.slice(0, 200),
      summary: summary === "" ? null : summary,
      bodyHtml: body.html,
      plainText: body.text,
      signature: signature === "" ? null : signature,
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

/**
 * Write (upsert) the per-language translation rows for one revision.
 *
 * A language whose text actually moved loses whatever approvals it had: an
 * approval is about words somebody read, and these are no longer those words
 * (server/content/language-review.ts). Saving the form without touching a
 * language leaves its review where it was, so an unrelated edit elsewhere on the
 * page does not send everything back to the start of the queue.
 *
 * `state` and `method` are decided here too, and never read from the form: the
 * source language is authored, and a target language is machine output, edited
 * machine output, or somebody's own writing depending on whether the submitted
 * text still hashes to what the generator signed (server/translation/provenance).
 */
async function writeTranslations(
  tx: Tx,
  revisionId: string,
  sourceVersionId: string,
  translations: AuthoredTranslation[],
  sourceLanguageCode: string,
) {
  const stored = await tx
    .select({
      languageCode: editorialRevisionTranslations.languageCode,
      contentHash: editorialRevisionTranslations.contentHash,
      title: editorialRevisionTranslations.title,
      bodyJson: editorialRevisionTranslations.bodyJson,
      state: editorialRevisionTranslations.state,
      method: editorialRevisionTranslations.method,
      providerCode: editorialRevisionTranslations.providerCode,
    })
    .from(editorialRevisionTranslations)
    .where(eq(editorialRevisionTranslations.revisionId, revisionId));
  const storedByLanguage = new Map(
    stored.map((row) => [row.languageCode, row]),
  );

  for (const translation of translations) {
    const contentHash = localizedContentHash(
      translation.languageCode,
      toLocalized(translation),
    );
    const previous = storedByLanguage.get(translation.languageCode);
    const unchanged = previous?.contentHash === contentHash;
    const provenance = classifyTranslation({
      entityKind: "editorial_entry",
      targetLanguageCode: translation.languageCode as EditorialLanguage,
      payload: provenancePayload(translation),
      signature: translation.signature,
      existing: previous
        ? {
            method: previous.method,
            state: previous.state,
            providerCode: previous.providerCode,
            payload: {
              title: previous.title,
              bodyHtml: storedBodyHtml(previous.bodyJson),
            },
          }
        : null,
      isSource: translation.languageCode === sourceLanguageCode,
    });
    await tx
      .insert(editorialRevisionTranslations)
      .values({
        revisionId,
        languageCode: translation.languageCode,
        title: translation.title,
        summary: translation.summary,
        bodyJson: translation.bodyHtml ? { html: translation.bodyHtml } : null,
        plainText: translation.plainText,
        state: provenance.state,
        method: provenance.method,
        providerCode: provenance.providerCode,
        sourceVersionId,
        contentHash,
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
          state: provenance.state,
          method: provenance.method,
          providerCode: provenance.providerCode,
          sourceVersionId,
          contentHash,
          ...(unchanged ? {} : clearedLanguageReview),
        },
      });
  }
}

/* ---------------------------------------------------------------- */
/* Create                                                           */
/* ---------------------------------------------------------------- */

const createSchema = z.object({
  organizationId: optionalText.pipe(z.string().uuid().nullable()),
  scope: z.enum(articleScopes),
  cityId: optionalText.pipe(z.string().uuid().nullable()),
  slug: optionalText,
  tagIds: z.array(z.string().uuid()).max(3),
  coverAssetId: optionalText.pipe(z.string().uuid().nullable()),
  sourceLanguage: languageSchema,
  articleDate: optionalText,
  featured: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  canBecomeOutdated: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  unreliableFrom: optionalText,
  sourceSummary: optionalText,
  publicationMode: publicationModeSchema.default("draft"),
  publishAt: optionalText,
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
  async (formData, locale, user) => {
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
    const publishes = publishesOnSave(parsed.publicationMode);
    const requestedStage = requestedReviewStage(parsed.publicationMode);
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
    if (publishes) {
      await requirePermission(
        "content.article.publish",
        locale,
        parsed.organizationId ?? undefined,
      );
      // Nothing on a form that has never been saved has been reviewed by
      // anyone, so going public straight from it belongs to whoever holds the
      // platform's own check (server/content/language-review.ts). Everyone else
      // saves a draft and sends it up the chain from the language panel.
      await requirePermission(platformVerifyPermission, locale);
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
            eq(assets.uploaderId, user.id),
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
          authorId: user.id,
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
        createdById: user.id,
        isNewRevision: false,
        previousVersionId: null,
      });
      await writeTranslations(
        tx,
        revision.id,
        sourceVersionId,
        translations,
        parsed.sourceLanguage,
      );

      await tx.insert(editorialCustodianships).values({
        entryId: createdEntry.id,
        custodianKind: parsed.organizationId ? "organization" : "platform",
        organizationId: parsed.organizationId,
        actorUserId: user.id,
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
              eq(assets.uploaderId, user.id),
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

      // Asking for a read is per language, and the ask covers everything the
      // form actually carried text for — a reviewer opening this record is
      // meant to read it, not just the language it was drafted in.
      if (requestedStage) {
        await tx
          .update(editorialRevisionTranslations)
          .set({
            reviewStage: requestedStage,
            reviewRequestedById: user.id,
            reviewRequestedAt: new Date(),
          })
          .where(eq(editorialRevisionTranslations.revisionId, revision.id));
      }

      if (publishes) {
        await tx.insert(editorialPublications).values({
          entryId: createdEntry.id,
          languageCode: parsed.sourceLanguage,
          revisionId: revision.id,
          sourceVersionId,
          translationContentHash: localizedContentHash(
            parsed.sourceLanguage,
            toLocalized(sourceTranslation),
          ),
          publishedById: user.id,
          scheduledFor,
        });
        await tx
          .update(editorialRevisionTranslations)
          .set({
            state: "verified",
            // Reaching here means the platform's own check was required above,
            // so the chain records what actually happened rather than leaving a
            // published language looking as though nobody had seen it.
            reviewStage: "platform_verified",
            verifiedById: user.id,
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
    if (requestedStage) {
      await recordAudit({
        action: "translation.review_requested",
        subjectType: "editorial_entry",
        subjectId: entry.id,
        organizationId: parsed.organizationId,
        metadata: {
          stage: requestedStage,
          languages: translations
            .map((translation) => translation.languageCode)
            .join(","),
        },
      });
    }
    if (publishes) {
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
  articleDate: optionalText,
  tagIds: z.array(z.string().uuid()).max(3),
  featured: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
});

export const saveArticleContent = protectedPermissionAction(
  "content.article.write",
  async (formData, locale, user) => {
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
            authorId: user.id,
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
        createdById: user.id,
        isNewRevision,
        previousVersionId: previousSourceVersionId,
      });
      await writeTranslations(
        tx,
        revisionId,
        sourceVersionId,
        translations,
        latest.sourceLanguageCode,
      );

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
  unreliableFrom: optionalText,
  sourceSummary: optionalText,
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
  publishAt: optionalText,
});

export const publishArticleLanguage = protectedPermissionAction(
  "content.article.publish",
  async (formData, locale, user) => {
    const parsed = publishSchema.parse({
      entryId: formData.get("entryId"),
      languageCode: formData.get("languageCode"),
      publishAt: formData.get("publishAt") ?? "",
    });
    const scheduledFor = parsed.publishAt
      ? parseScheduledPublication("scheduled", parsed.publishAt)
      : null;
    /**
     * The platform's own check is the last gate before a visitor reads this
     * (server/content/language-review.ts). Whoever holds that grant *is* the
     * check, so they are not asked to send the text to themselves first.
     */
    const asPlatformVerifier = await hasPermission(platformVerifyPermission);

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
      if (
        !platformCleared({
          stage: translation.reviewStage,
          bypass: asPlatformVerifier,
        })
      ) {
        throw new Error(
          "The platform must verify this language before it is published",
        );
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
        .set({ unpublishedAt: new Date(), unpublishedById: user.id })
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
        publishedById: user.id,
        scheduledFor,
      });

      await tx
        .update(editorialRevisionTranslations)
        .set({
          state: "verified",
          reviewStage: "platform_verified",
          verifiedById: user.id,
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
  async (formData, locale, user) => {
    const parsed = publishSchema.parse({
      entryId: formData.get("entryId"),
      languageCode: formData.get("languageCode"),
    });

    await db.transaction(async (tx) => {
      await tx
        .update(editorialPublications)
        .set({ unpublishedAt: new Date(), unpublishedById: user.id })
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

/**
 * Take an article out of the workspace. Two conditions, both checked here and
 * not only in the menu that offers it:
 *
 * - Nothing of it may be published. What the public has been told stays true
 *   until someone takes each language down deliberately, so archiving cannot be
 *   the thing that quietly unpublishes it. A language waiting for its date is a
 *   promise too.
 * - Whoever wrote its first revision, or a platform administrator, is who may do
 *   it — the second because an article outlives the account that wrote it, and a
 *   seeded article was written by nobody at all.
 */
export const archiveArticle = protectedPermissionAction(
  "content.article.publish",
  async (formData, locale, user) => {
    const parsed = entrySchema.parse({ entryId: formData.get("entryId") });
    const [entry] = await db
      .select({ id: editorialEntries.id })
      .from(editorialEntries)
      .where(
        and(
          eq(editorialEntries.id, parsed.entryId),
          isNull(editorialEntries.archivedAt),
        ),
      )
      .limit(1);
    if (!entry) throw new Error("Unknown article");

    // The first revision is the article's authorship: later ones are edits.
    const [origin] = await db
      .select({ authorId: editorialRevisions.authorId })
      .from(editorialRevisions)
      .where(eq(editorialRevisions.entryId, parsed.entryId))
      .orderBy(asc(editorialRevisions.revisionNumber))
      .limit(1);
    const isPlatformAdministrator = await hasActualPlatformPermission(
      user.id,
      superadminPermission,
    );
    if (origin?.authorId !== user.id && !isPlatformAdministrator) {
      throw new Error("Forbidden");
    }

    const [live] = await db
      .select({ id: editorialPublications.id })
      .from(editorialPublications)
      .where(
        and(
          eq(editorialPublications.entryId, parsed.entryId),
          isNull(editorialPublications.unpublishedAt),
        ),
      )
      .limit(1);
    if (live) throw new Error("Unpublish every language first");

    await db
      .update(editorialEntries)
      .set({
        workflowState: "archived",
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(editorialEntries.id, parsed.entryId));
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
  publisher: optionalText,
  url: optionalText.pipe(z.string().url().nullable()),
  sourceDate: optionalText,
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
