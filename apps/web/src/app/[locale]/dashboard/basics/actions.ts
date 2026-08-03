"use server";

import type { Locale } from "@infokit/shared/i18n";
import { and, asc, desc, eq, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { basicInformationReaches } from "~/lib/basic-information";
import { optionalText, optionalUuid } from "~/lib/form-fields";
import { recordAudit } from "~/server/audit";
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
import { db } from "~/server/db";
import { sanitizeRichText } from "~/server/content/sanitize-rich-text";
import { classifyTranslation } from "~/server/translation/provenance";
import {
  basicInformationDetails,
  editorialCustodianships,
  editorialEntries,
  editorialPublications,
  editorialRevisions,
  editorialRevisionTranslations,
  languages as languageCatalog,
  translationSourceVersions,
} from "~/server/db/schema";

/**
 * Authoring for the basic-information block: the numbers a person calls when
 * something is happening now, and the shortest routes to urgent help
 * (docs/PHASE-1-PUBLIC-INFORMATION.md §5).
 *
 * These are articles in every mechanical sense — an entry, immutable revisions,
 * a pinned publication per language — and the newsroom's own actions are the
 * model this mirrors deliberately rather than abstracts over
 * (`../articles/actions.ts`). Two things differ, and both are the point of the
 * kind existing:
 *
 * - **The words are content.** A tile's label and the sentence saying *when to
 *   use it* are authored and translated in the eleven languages like any other
 *   editorial text. That is what a hardcoded `basics.help.*` catalogue key could
 *   never be: correctable by the people who answer the phone, and dated.
 * - **The digits are not.** `dial` is typed once and never translated, and a
 *   number is only ever published in a language somebody has actually read.
 *
 * There is no body and no cover image: a tile is a label, a sentence, and a
 * number. `summary` carries the sentence, which is why `readTranslations` below
 * requires it rather than treating it as optional the way an article does — a
 * tile that says "Alarm Phone" and nothing else tells a reader nothing about
 * whether to call it.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const languageSchema = z.enum(editorialLanguages);
const publicationModeSchema = z.enum([
  "draft",
  "team",
  "platform",
  "now",
  "scheduled",
]);

const WRITE = "content.basic_information.write";
const PUBLISH = "content.basic_information.publish";

function refresh(locale: Locale) {
  revalidatePath(localizedPath("/dashboard", locale));
  revalidatePath(localizedPath("/dashboard/basics", locale));
  // The block these rows render into. Every public locale reads the same
  // entries, so one edit invalidates all of them rather than the one the editor
  // happened to be working in.
  for (const publicLocale of editorialLanguages) {
    revalidatePath(localizedPath("/", publicLocale));
  }
}

/** Read one text field as a trimmed string, ignoring File entries. */
function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * One language of a tile: the label, and the sentence saying when to use it.
 *
 * No body — see the note at the top of this file. The `signature` is the claim a
 * machine draft came back with, never trusted: `writeTranslations` re-derives
 * the hash from what was actually submitted and compares
 * (server/translation/provenance.ts).
 */
interface AuthoredTranslation {
  languageCode: string;
  title: string;
  summary: string;
  signature: string | null;
  /**
   * The exact HTML the signature was computed over, as the generator returned
   * it. Only ever a witness — never stored, never rendered.
   */
  proposedHtml: string;
}

/**
 * What provenance is decided over.
 *
 * The generator signs a *rich-text body* (`server/translation/generate.ts`
 * hashes `{title, bodyHtml}`), and a tile has no body: its context is one plain
 * sentence. So a machine draft arrives as HTML, the sentence stored is that
 * HTML's plain text, and the HTML travels back on save purely as the witness
 * this hash is taken over.
 *
 * The witness is used only while it still describes the submitted sentence. Once
 * an editor rewrites the sentence, its own text is hashed instead — which cannot
 * match the claim, and `classifyTranslation` records `ai_then_human_review`.
 * That is the honest answer, and it is why the comparison is on plain text
 * rather than on the HTML: the editor edits a textarea and never sees the
 * markup, so markup is not evidence of anything they did.
 *
 * With no signature there is nothing to witness, so the sentence stands for
 * itself — and it has to, because that is the branch where `classifyTranslation`
 * compares against the *stored* row, which holds the sentence and never the
 * markup. Hashing HTML on one side and plain text on the other would report
 * every re-save of an untouched draft as an edit.
 */
function provenancePayload(translation: AuthoredTranslation) {
  const witnessedText = translation.signature
    ? plainTextOf(translation.proposedHtml)
    : "";
  const untouched =
    witnessedText !== "" &&
    witnessedText === normalizeText(translation.summary);
  return {
    title: translation.title,
    bodyHtml: untouched ? translation.proposedHtml : translation.summary,
  };
}

/** Whitespace-folded, matching what `translationPayloadHash` compares on. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** The reading text of a generated fragment, with no tags and no entities. */
function plainTextOf(html: string): string {
  return normalizeText(sanitizeRichText(html).text ?? "");
}

/**
 * Collect the per-language fields the form submits.
 *
 * A language counts as authored only when it carries *both* the label and the
 * context. Half a tile is worse than none of it: "Alarm Phone" with no sentence
 * leaves a reader to guess when a volunteer line is the right call, and the
 * guessing happens in an emergency.
 */
function readTranslations(formData: FormData): AuthoredTranslation[] {
  const result: AuthoredTranslation[] = [];
  for (const language of editorialLanguages) {
    const upper = language.toUpperCase();
    const title = field(formData, `title${upper}`);
    const summary = field(formData, `summary${upper}`);
    if (!title || !summary) continue;
    const signature = field(formData, `translation_proposal_${language}`);
    result.push({
      languageCode: language,
      title: title.slice(0, 200),
      summary,
      signature: signature === "" ? null : signature,
      proposedHtml: field(formData, `body${upper}Html`),
    });
  }
  return result;
}

function toLocalized(translation: AuthoredTranslation): LocalizedContent {
  return {
    title: translation.title,
    summary: translation.summary,
    bodyHtml: null,
    plainText: null,
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

async function uniqueSlug(tx: Tx, desired: string): Promise<string> {
  const base = slugify(desired);
  let candidate = base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [taken] = await tx
      .select({ id: editorialEntries.id })
      .from(editorialEntries)
      .where(eq(editorialEntries.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
    candidate = `${base.slice(0, 140)}-${String(attempt + 2)}`;
  }
  return `${base.slice(0, 130)}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Rebuild the immutable source version for one revision from its current
 * translations. In-place for an unsealed revision, or a fresh successor when
 * the revision was opened because its predecessor is sealed.
 */
async function writeSourceVersion(
  tx: Tx,
  input: {
    entryId: string;
    organizationId: string | null;
    revisionId: string;
    sourceLanguageCode: string;
    translations: AuthoredTranslation[];
    createdById: string | null;
    isNewRevision: boolean;
    previousVersionId: string | null;
  },
): Promise<string> {
  const sourceContent: SourceContent = {
    sourceLanguage: input.sourceLanguageCode,
    articleDate: null,
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
 * Write (upsert) the per-language rows for one revision.
 *
 * A language whose text actually moved loses whatever approvals it had — an
 * approval is about words somebody read, and these are no longer those words
 * (server/content/language-review.ts). `state` and `method` are decided here and
 * never read from the form.
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
      summary: editorialRevisionTranslations.summary,
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
      targetLanguageCode:
        translation.languageCode as (typeof editorialLanguages)[number],
      payload: provenancePayload(translation),
      signature: translation.signature,
      existing: previous
        ? {
            method: previous.method,
            state: previous.state,
            providerCode: previous.providerCode,
            payload: {
              title: previous.title,
              bodyHtml: previous.summary,
            },
          }
        : null,
      isSource: translation.languageCode === sourceLanguageCode,
    });
    const values = {
      title: translation.title,
      summary: translation.summary,
      state: provenance.state,
      method: provenance.method,
      providerCode: provenance.providerCode,
      sourceVersionId,
      contentHash,
    };
    await tx
      .insert(editorialRevisionTranslations)
      .values({
        revisionId,
        languageCode: translation.languageCode,
        ...values,
      })
      .onConflictDoUpdate({
        target: [
          editorialRevisionTranslations.revisionId,
          editorialRevisionTranslations.languageCode,
        ],
        set: {
          ...values,
          ...(unchanged ? {} : clearedLanguageReview),
        },
      });
  }
}

/* ---------------------------------------------------------------- */
/* The tile's own fields                                            */
/* ---------------------------------------------------------------- */

/**
 * The digits, as whoever published them prints them.
 *
 * Spacing is preserved rather than normalised, and that is deliberate: the
 * public payload strips it for the `tel:` href and shows the typed form to the
 * reader, so a number stays copyable onto paper exactly as its source printed
 * it. Validation only rejects what cannot be a phone number at all — a short
 * code like `112` and an international number are both real answers.
 */
const dialSchema = optionalText.pipe(
  z
    .string()
    .max(40)
    .regex(/^[+(]?[\d][\d\s./()+-]*$/, "dial")
    .nullable(),
);

const detailSchema = z.object({
  icon: z.string().trim().min(1).max(50),
  priority: z.coerce.number().int().min(0).max(999),
  emergency: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  /**
   * Whose phone rings. Defaulted to `state` when the form says nothing, which
   * matches the column default and is the answer that claims least: a tile that
   * lands among the emergency numbers asserts nothing about who owns it, where
   * one filed under the association heading tells a reader a volunteer will
   * answer.
   */
  operator: z.enum(["state", "association"]).catch("state"),
  categoryId: optionalUuid,
  dial: dialSchema,
  reach: optionalText.pipe(z.enum(basicInformationReaches).nullable()),
  dialInstead: dialSchema,
  answeredByOrganizationId: optionalUuid,
});

function parseDetail(formData: FormData) {
  const parsed = detailSchema.parse({
    icon: formData.get("icon"),
    priority: formData.get("priority") ?? "0",
    emergency: formData.get("emergency") ?? "",
    operator: formData.get("operator") ?? "state",
    categoryId: formData.get("categoryId") ?? "",
    dial: formData.get("dial") ?? "",
    reach: formData.get("reach") ?? "",
    dialInstead: formData.get("dialInstead") ?? "",
    answeredByOrganizationId: formData.get("answeredByOrganizationId") ?? "",
  });
  /**
   * The same two rules the database check enforces, refused here so the editor
   * reads a sentence instead of a constraint violation. The check stays as well:
   * this validates a form, and that one holds for every writer.
   */
  if ((parsed.dial === null) !== (parsed.reach === null)) {
    throw new Error(
      "A tile with a number needs to say how it is reached, and one without a number cannot have a reach",
    );
  }
  if (parsed.dialInstead !== null && parsed.dial === null) {
    throw new Error("A tile can only redirect a call it also displays");
  }
  return parsed;
}

/* ---------------------------------------------------------------- */
/* Create                                                           */
/* ---------------------------------------------------------------- */

const createSchema = z.object({
  organizationId: optionalUuid,
  cityId: optionalUuid,
  slug: optionalText,
  sourceLanguage: languageSchema,
  reviewIntervalDays: z.coerce.number().int().min(1).max(3650),
  sourceSummary: optionalText,
  publicationMode: publicationModeSchema.default("draft"),
  publishAt: optionalText,
});

export const createBasicInformation = protectedPermissionAction(
  WRITE,
  async (formData, locale, user) => {
    const parsed = createSchema.parse({
      organizationId: formData.get("organizationId") ?? "",
      cityId: formData.get("cityId") ?? "",
      slug: formData.get("slug") ?? "",
      sourceLanguage: formData.get("sourceLanguage"),
      reviewIntervalDays: formData.get("reviewIntervalDays") ?? "90",
      sourceSummary: formData.get("sourceSummary") ?? "",
      publicationMode: formData.get("publicationMode") ?? "draft",
      publishAt: formData.get("publishAt") ?? "",
    });
    const detail = parseDetail(formData);
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
      throw new Error(
        "The source language needs both a label and the sentence saying when to use it",
      );
    }
    if (publishes) {
      await requirePermission(PUBLISH, locale);
      // Nothing on a form that has never been saved has been read by anyone, so
      // going public straight from it belongs to whoever holds the platform's
      // own check (server/content/language-review.ts).
      await requirePermission(platformVerifyPermission, locale);
    }

    /**
     * When this has to be looked at again, set from the interval the editor
     * chose. Every other content type carries a review date and these are the
     * rows where a stale one is most expensive, so the column is filled at
     * creation rather than left for somebody to remember.
     */
    const now = new Date();
    const reviewDueAt = new Date(
      now.getTime() + parsed.reviewIntervalDays * 24 * 60 * 60 * 1000,
    );

    const entry = await db.transaction(async (tx) => {
      const slug = await uniqueSlug(tx, parsed.slug ?? sourceTranslation.title);
      const [createdEntry] = await tx
        .insert(editorialEntries)
        .values({
          kind: "basic_information",
          slug,
          workflowState: "draft",
          cityId: parsed.cityId,
        })
        .returning({ id: editorialEntries.id });
      if (!createdEntry) {
        throw new Error("Basic information insert returned no row");
      }

      /**
       * No `editorial_entry_routes` row. A tile is read inside the urgent block
       * on the home page, not at a URL of its own, and a route reserves a slug
       * in a language's namespace that nothing will ever serve. The typed detail
       * table and the publications are what the public read model joins.
       */
      await tx.insert(basicInformationDetails).values({
        entryId: createdEntry.id,
        icon: detail.icon,
        priority: detail.priority,
        emergency: detail.emergency,
        operator: detail.operator,
        categoryId: detail.categoryId,
        dial: detail.dial,
        reach: detail.reach,
        dialInstead: detail.dialInstead,
        answeredByOrganizationId: detail.answeredByOrganizationId,
      });

      const [revision] = await tx
        .insert(editorialRevisions)
        .values({
          entryId: createdEntry.id,
          revisionNumber: 1,
          authorId: user.id,
          sourceLanguageCode: parsed.sourceLanguage,
          /**
           * True for every one of these, always. A phone number answered by an
           * association is exactly the fact that goes stale silently — the line
           * moves when the association reorganises — so the public warning this
           * drives is the mechanic the kind exists for
           * (docs/LANDSCAPE.md §2).
           */
          canBecomeOutdated: true,
          sourceSummary: parsed.sourceSummary,
          lastReviewedAt: now,
          reviewDueAt,
        })
        .returning({ id: editorialRevisions.id });
      if (!revision) throw new Error("Revision insert returned no row");

      const sourceVersionId = await writeSourceVersion(tx, {
        entryId: createdEntry.id,
        organizationId: parsed.organizationId,
        revisionId: revision.id,
        sourceLanguageCode: parsed.sourceLanguage,
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
        }
      }

      return { id: createdEntry.id };
    });

    await recordAudit({
      action: "basic_information.created",
      subjectType: "editorial_entry",
      subjectId: entry.id,
      organizationId: parsed.organizationId,
      metadata: {
        sourceLanguage: parsed.sourceLanguage,
        publicationMode: parsed.publicationMode,
        dial: detail.dial,
        scheduledFor: scheduledFor?.toISOString() ?? null,
      },
    });
    if (publishes) {
      await recordAudit({
        action: scheduledFor
          ? "basic_information.language_scheduled"
          : "basic_information.language_published",
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
      `${localizedPath("/dashboard/basics", locale)}?entry=${entry.id}&notice=basic-information-created`,
    );
  },
);

/* ---------------------------------------------------------------- */
/* Save (upsert translations onto the editable revision)            */
/* ---------------------------------------------------------------- */

const saveSchema = z.object({ entryId: z.string().uuid() });

export const saveBasicInformation = protectedPermissionAction(
  WRITE,
  async (formData, locale, user) => {
    const parsed = saveSchema.parse({ entryId: formData.get("entryId") });
    const detail = parseDetail(formData);
    const translations = readTranslations(formData);
    if (translations.length === 0) {
      throw new Error(
        "At least the source language must keep a label and its context",
      );
    }

    await db.transaction(async (tx) => {
      const [entry] = await tx
        .select({ id: editorialEntries.id, kind: editorialEntries.kind })
        .from(editorialEntries)
        .where(eq(editorialEntries.id, parsed.entryId));
      if (entry?.kind !== "basic_information") {
        throw new Error("Unknown basic-information entry");
      }

      const [latest] = await tx
        .select()
        .from(editorialRevisions)
        .where(eq(editorialRevisions.entryId, parsed.entryId))
        .orderBy(desc(editorialRevisions.revisionNumber))
        .limit(1);
      if (!latest) throw new Error("This entry has no revision");

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
            lastReviewedAt: latest.lastReviewedAt,
            reviewDueAt: latest.reviewDueAt,
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

      /**
       * The tile's own fields are edited in place: they are not the authored
       * text a publication pins, and a published entry whose icon changed has
       * not changed what it says. The digits are the exception in spirit but not
       * in mechanics — a changed number clears every language's review below,
       * because a tile whose number moved is a tile nobody has verified.
       */
      const [storedDetail] = await tx
        .select({ dial: basicInformationDetails.dial })
        .from(basicInformationDetails)
        .where(eq(basicInformationDetails.entryId, parsed.entryId));
      await tx
        .update(basicInformationDetails)
        .set({
          icon: detail.icon,
          priority: detail.priority,
          emergency: detail.emergency,
          operator: detail.operator,
          categoryId: detail.categoryId,
          dial: detail.dial,
          reach: detail.reach,
          dialInstead: detail.dialInstead,
          answeredByOrganizationId: detail.answeredByOrganizationId,
        })
        .where(eq(basicInformationDetails.entryId, parsed.entryId));
      if ((storedDetail?.dial ?? null) !== detail.dial) {
        await tx
          .update(editorialRevisionTranslations)
          .set(clearedLanguageReview)
          .where(eq(editorialRevisionTranslations.revisionId, revisionId));
      }

      await tx
        .update(editorialEntries)
        .set({ updatedAt: new Date() })
        .where(eq(editorialEntries.id, parsed.entryId));
    });

    await recordAudit({
      action: "basic_information.saved",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
      metadata: { dial: detail.dial },
    });
    refresh(locale);
  },
);

/* ---------------------------------------------------------------- */
/* Freshness (edited in place — metadata, not sealed content)       */
/* ---------------------------------------------------------------- */

const freshnessSchema = z.object({
  entryId: z.string().uuid(),
  reviewIntervalDays: z.coerce.number().int().min(1).max(3650),
});

/**
 * "I have just checked this number and it still answers."
 *
 * The one action that makes the whole kind worth building: it moves
 * `lastReviewedAt` to now and pushes the next due date out by the interval, so
 * the public block can say how old a number is instead of leaving a reader to
 * assume. Nothing about the text changes, so this edits the revision in place
 * rather than opening a new one.
 */
export const confirmBasicInformation = protectedPermissionAction(
  WRITE,
  async (formData, locale) => {
    const parsed = freshnessSchema.parse({
      entryId: formData.get("entryId"),
      reviewIntervalDays: formData.get("reviewIntervalDays") ?? "90",
    });
    const now = new Date();
    const reviewDueAt = new Date(
      now.getTime() + parsed.reviewIntervalDays * 24 * 60 * 60 * 1000,
    );

    const [latest] = await db
      .select({ id: editorialRevisions.id })
      .from(editorialRevisions)
      .where(eq(editorialRevisions.entryId, parsed.entryId))
      .orderBy(desc(editorialRevisions.revisionNumber))
      .limit(1);
    if (!latest) throw new Error("This entry has no revision");

    await db
      .update(editorialRevisions)
      .set({ lastReviewedAt: now, reviewDueAt })
      .where(eq(editorialRevisions.id, latest.id));

    await recordAudit({
      action: "basic_information.confirmed",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
      metadata: { reviewDueAt: reviewDueAt.toISOString() },
    });
    refresh(locale);
  },
);

/* ---------------------------------------------------------------- */
/* Publication                                                      */
/* ---------------------------------------------------------------- */

const publishSchema = z.object({
  entryId: z.string().uuid(),
  languageCode: languageSchema,
  publishAt: optionalText,
});

export const publishBasicInformationLanguage = protectedPermissionAction(
  PUBLISH,
  async (formData, locale, user) => {
    const parsed = publishSchema.parse({
      entryId: formData.get("entryId"),
      languageCode: formData.get("languageCode"),
      publishAt: formData.get("publishAt") ?? "",
    });
    const scheduledFor = parsed.publishAt
      ? parseScheduledPublication("scheduled", parsed.publishAt)
      : null;
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
      if (!latest) throw new Error("This entry has no revision");

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
        throw new Error("This language has no authored label to publish");
      }
      /**
       * The rule the whole kind turns on: a number reaches a reader in their own
       * language only with the sentence saying when to dial it. A label alone is
       * a phone number with no context, in a language whose reader has no other
       * page to fall back to.
       */
      if (!translation.summary) {
        throw new Error(
          "This language needs the sentence saying when to use this number before it can be published",
        );
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
    });

    await recordAudit({
      action: scheduledFor
        ? "basic_information.language_scheduled"
        : "basic_information.language_published",
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

const unpublishSchema = z.object({
  entryId: z.string().uuid(),
  languageCode: languageSchema,
});

export const unpublishBasicInformationLanguage = protectedPermissionAction(
  PUBLISH,
  async (formData, locale, user) => {
    const parsed = unpublishSchema.parse({
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

      // The entry stops being published when its last language does.
      const [remaining] = await tx
        .select({ id: editorialPublications.id })
        .from(editorialPublications)
        .where(
          and(
            eq(editorialPublications.entryId, parsed.entryId),
            isNull(editorialPublications.unpublishedAt),
          ),
        )
        .limit(1);
      if (!remaining) {
        await tx
          .update(editorialEntries)
          .set({ workflowState: "unpublished", updatedAt: new Date() })
          .where(eq(editorialEntries.id, parsed.entryId));
      }
    });

    await recordAudit({
      action: "basic_information.language_unpublished",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
      metadata: { languageCode: parsed.languageCode },
    });
    refresh(locale);
  },
);

const entrySchema = z.object({ entryId: z.string().uuid() });

/**
 * Archive, which for these is a heavier decision than for an article: a tile
 * that disappears takes a phone number off the one block a reader in trouble
 * opens first. It stays recoverable (`archivedAt`, DATABASE-SCHEMA.md §2) and
 * every active publication is retired with it, so nothing keeps rendering from
 * an entry the workspace considers gone.
 */
export const archiveBasicInformation = protectedPermissionAction(
  PUBLISH,
  async (formData, locale, user) => {
    const parsed = entrySchema.parse({ entryId: formData.get("entryId") });
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(editorialPublications)
        .set({ unpublishedAt: now, unpublishedById: user.id })
        .where(
          and(
            eq(editorialPublications.entryId, parsed.entryId),
            isNull(editorialPublications.unpublishedAt),
          ),
        );
      await tx
        .update(editorialEntries)
        .set({ workflowState: "archived", archivedAt: now, updatedAt: now })
        .where(eq(editorialEntries.id, parsed.entryId));
    });

    await recordAudit({
      action: "basic_information.archived",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    refresh(locale);
  },
);

export const restoreBasicInformation = protectedPermissionAction(
  PUBLISH,
  async (formData, locale) => {
    const parsed = entrySchema.parse({ entryId: formData.get("entryId") });
    await db
      .update(editorialEntries)
      .set({
        workflowState: "draft",
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(editorialEntries.id, parsed.entryId));

    await recordAudit({
      action: "basic_information.restored",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    refresh(locale);
  },
);

/**
 * Reorder the block. `priority` decides which tile a reader sees first, and on
 * this surface that ordering is itself safety advice — 112 above a volunteer
 * line, not beside it — so it is one deliberate action rather than a field
 * buried in each record's form.
 */
const reorderSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Positions are spaced ten apart — 10, 20, 30 — the way the seed writes them
 * (server/db/seed-basic-information.ts).
 *
 * The gaps are the point: a number can be slid between two others by giving it
 * 15 without touching either neighbour, which matters when the thing being
 * reordered is which emergency line a reader meets first. Writing a dense
 * `0,1,2` here quietly spent that room the first time anybody pressed save, and
 * left the seeded block and the reordered block numbered by different rules.
 *
 * `max(50)` above keeps the top value inside `priority`'s 0–999 range.
 */
const PRIORITY_STEP = 10;

export const reorderBasicInformation = protectedPermissionAction(
  WRITE,
  async (formData, locale) => {
    const parsed = reorderSchema.parse({
      entryIds: formData.getAll("entryIds"),
    });
    await db.transaction(async (tx) => {
      for (const [index, entryId] of parsed.entryIds.entries()) {
        await tx
          .update(basicInformationDetails)
          .set({ priority: (index + 1) * PRIORITY_STEP })
          .where(eq(basicInformationDetails.entryId, entryId));
      }
    });
    await recordAudit({
      action: "basic_information.reordered",
      subjectType: "editorial_entry",
      subjectId: parsed.entryIds[0] ?? null,
      metadata: { order: parsed.entryIds.join(",") },
    });
    refresh(locale);
  },
);

/** The ordered entries, for a caller that needs the current sequence. */
export async function basicInformationOrder(): Promise<string[]> {
  const rows = await db
    .select({ entryId: basicInformationDetails.entryId })
    .from(basicInformationDetails)
    .innerJoin(
      editorialEntries,
      eq(editorialEntries.id, basicInformationDetails.entryId),
    )
    .where(isNull(editorialEntries.archivedAt))
    .orderBy(
      asc(basicInformationDetails.priority),
      asc(basicInformationDetails.entryId),
    );
  return rows.map((row) => row.entryId);
}
