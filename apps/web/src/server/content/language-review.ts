import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { EditorialLanguage } from "~/lib/editorial-languages";
import {
  reviewEntityKinds,
  type LanguageReviewStage,
  type ReviewEntityKind,
} from "~/lib/language-review";
import { db } from "~/server/db";
import {
  activities,
  activityTranslations,
  editorialRevisions,
  editorialRevisionTranslations,
} from "~/server/db/schema";

/**
 * The two-stage review one language goes through before the public sees it.
 *
 * A colleague reading the text through is optional — the editors decide among
 * themselves whether to ask. The platform's own check is not: a language nobody
 * at the platform has confirmed cannot be published, and `assertPlatformCleared`
 * below is where that stops being a convention and starts being a rule.
 *
 * Note what this does *not* touch. `translations.state` is provenance — human,
 * machine, machine-then-edited — derived by the server from a signed proposal on
 * every save (see `server/translation/provenance.ts`). A workflow queue stored
 * there would be recomputed away by the next keystroke saved, which is why the
 * chain has its own `review_stage` column and reads `state` only for display.
 */

/**
 * The stage names themselves are shared with the browser — the menu that offers
 * "send this to the platform" has to speak them too — so they live in
 * `~/lib/language-review` and are re-exported here for the server's callers.
 */
export { reviewEntityKinds };
export type { LanguageReviewStage, ReviewEntityKind };

/** The grant that means "the platform itself has checked this". */
export const platformVerifyPermission = "content.translation.verify";

/** What one language looks like to the chain, before it moves it. */
export interface LanguageReviewRow {
  /** Scopes the permission check; null for content the platform holds. */
  organizationId: string | null;
  sourceLanguageCode: EditorialLanguage;
  /** Empty when nothing has been written in this language yet. */
  title: string;
  stage: LanguageReviewStage;
  teamValidatedAt: Date | null;
  verifiedAt: Date | null;
}

/** Columns the chain writes. Everything omitted keeps its stored value. */
interface LanguageReviewPatch {
  stage: LanguageReviewStage;
  reviewRequestedById?: string | null;
  reviewRequestedAt?: Date | null;
  teamValidatedById?: string | null;
  teamValidatedAt?: Date | null;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  reviewNote?: string | null;
}

interface ReviewAdapter {
  kind: ReviewEntityKind;
  /** Who may send a language into the chain: whoever authors this kind. */
  authorPermission: string;
  /** Who may validate it as a colleague, before the platform looks at it. */
  teamPermission: string;
  /** What an audit row calls this record. */
  subjectType: string;
  load(
    entityId: string,
    language: EditorialLanguage,
  ): Promise<LanguageReviewRow | null>;
  /** False when the row is gone — a revision replaced, an activity deleted. */
  patch(
    entityId: string,
    language: EditorialLanguage,
    patch: LanguageReviewPatch,
  ): Promise<boolean>;
}

/**
 * Articles hold their translations against a revision, and the working copy is
 * always the newest one. A published revision is sealed and the next edit opens
 * a fresh one, whose languages start at `none` — so re-publishing changed text
 * asks the platform again rather than riding the previous approval.
 */
async function latestRevisionId(entryId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: editorialRevisions.id })
    .from(editorialRevisions)
    .where(eq(editorialRevisions.entryId, entryId))
    .orderBy(desc(editorialRevisions.revisionNumber))
    .limit(1);
  return row?.id ?? null;
}

const articleAdapter: ReviewAdapter = {
  kind: "editorial_entry",
  authorPermission: "content.article.write",
  teamPermission: "content.article.review",
  subjectType: "editorial_entry",
  async load(entityId, language) {
    const revisionId = await latestRevisionId(entityId);
    if (!revisionId) return null;
    const [row] = await db
      .select({
        sourceLanguageCode: editorialRevisions.sourceLanguageCode,
        title: editorialRevisionTranslations.title,
        stage: editorialRevisionTranslations.reviewStage,
        teamValidatedAt: editorialRevisionTranslations.teamValidatedAt,
        verifiedAt: editorialRevisionTranslations.verifiedAt,
      })
      .from(editorialRevisions)
      .leftJoin(
        editorialRevisionTranslations,
        and(
          eq(editorialRevisionTranslations.revisionId, editorialRevisions.id),
          eq(editorialRevisionTranslations.languageCode, language),
        ),
      )
      .where(eq(editorialRevisions.id, revisionId))
      .limit(1);
    if (!row) return null;
    return {
      organizationId: null,
      sourceLanguageCode: row.sourceLanguageCode as EditorialLanguage,
      title: row.title ?? "",
      stage: row.stage ?? "none",
      teamValidatedAt: row.teamValidatedAt,
      verifiedAt: row.verifiedAt,
    };
  },
  async patch(entityId, language, { stage, ...columns }) {
    const revisionId = await latestRevisionId(entityId);
    if (!revisionId) return false;
    const updated = await db
      .update(editorialRevisionTranslations)
      .set({ reviewStage: stage, ...columns })
      .where(
        and(
          eq(editorialRevisionTranslations.revisionId, revisionId),
          eq(editorialRevisionTranslations.languageCode, language),
        ),
      )
      .returning({ languageCode: editorialRevisionTranslations.languageCode });
    return updated.length > 0;
  },
};

const activityAdapter: ReviewAdapter = {
  kind: "activity",
  authorPermission: "content.activity.manage",
  teamPermission: "content.activity.verify",
  subjectType: "activity",
  async load(entityId, language) {
    const [row] = await db
      .select({
        organizationId: activities.organizationId,
        sourceLanguageCode: activities.sourceLanguageCode,
        title: activityTranslations.name,
        stage: activityTranslations.reviewStage,
        teamValidatedAt: activityTranslations.teamValidatedAt,
        verifiedAt: activityTranslations.verifiedAt,
      })
      .from(activities)
      .leftJoin(
        activityTranslations,
        and(
          eq(activityTranslations.activityId, activities.id),
          eq(activityTranslations.languageCode, language),
        ),
      )
      .where(eq(activities.id, entityId))
      .limit(1);
    if (!row) return null;
    return {
      organizationId: row.organizationId,
      sourceLanguageCode: row.sourceLanguageCode as EditorialLanguage,
      title: row.title ?? "",
      stage: row.stage ?? "none",
      teamValidatedAt: row.teamValidatedAt,
      verifiedAt: row.verifiedAt,
    };
  },
  async patch(entityId, language, { stage, ...columns }) {
    const updated = await db
      .update(activityTranslations)
      .set({ reviewStage: stage, ...columns })
      .where(
        and(
          eq(activityTranslations.activityId, entityId),
          eq(activityTranslations.languageCode, language),
        ),
      )
      .returning({ languageCode: activityTranslations.languageCode });
    return updated.length > 0;
  },
};

const adapters: Record<ReviewEntityKind, ReviewAdapter> = {
  editorial_entry: articleAdapter,
  activity: activityAdapter,
};

export function reviewAdapter(kind: ReviewEntityKind): ReviewAdapter {
  return adapters[kind];
}

/**
 * Whether this language may face the public.
 *
 * `bypass` is the actor holding the platform's own verify grant: they are the
 * stage the gate waits for, so asking them to first send the text to themselves
 * would only add a click. Everyone else needs the recorded approval.
 */
export function platformCleared({
  stage,
  bypass,
}: {
  stage: LanguageReviewStage;
  bypass: boolean;
}): boolean {
  return bypass || stage === "platform_verified";
}

/**
 * The columns that unwind the chain, for a save path to spread in when a
 * language's text has actually changed.
 *
 * An approval is about words somebody read, not about a language slot: once the
 * words move, nothing has been approved and the chain starts over. Without this,
 * a language could be verified once and then quietly rewritten before it went
 * live.
 */
export const clearedLanguageReview = {
  reviewStage: "none" as const,
  reviewRequestedById: null,
  reviewRequestedAt: null,
  teamValidatedById: null,
  teamValidatedAt: null,
  reviewNote: null,
};
