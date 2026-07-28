/**
 * The translator-link lifecycle, shared by every content type that can be sent
 * out for translation: articles, activities, organisation narratives and
 * simulator guides.
 *
 * All four follow one path. A request pins the entity's newest source version so
 * the translator is working from a fixed text, mails a link that expires, and
 * holds one live assignment per target language. A review then transitions the
 * assignment and, on acceptance, promotes the submitted text.
 *
 * What differs per type is only where accepted text lands — a revision-scoped
 * translation row, a profile row, a whole graph of steps — so that step alone is
 * a callback. Everything before it is the same guarantee for all of them, and is
 * written once here.
 */
import type { Locale } from "@infokit/shared/i18n";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { recordAudit } from "~/server/audit";
import { sendTranslationAssignmentEmail } from "~/server/auth/aws";
import type { ActionUser } from "~/server/auth/require";
import { db } from "~/server/db";
import type { translationAssignmentEntity } from "~/server/db/schema";
import {
  translationAssignmentEvents,
  translationAssignments,
  translationSourceVersions,
} from "~/server/db/schema";

/** The content types a translator link may target. */
export type TranslationEntityKind =
  (typeof translationAssignmentEntity.enumValues)[number];

/** The transaction handle a promote callback writes through. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The assignment row a promote callback is handed. */
export type TranslationAssignment = typeof translationAssignments.$inferSelect;

/** A blank optional field means "not given", not an empty value. */
function optionalFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const requestFields = z.object({
  targetLanguageCode: z.enum(editorialLanguageCodes),
  translatorEmail: z.string().trim().email().max(255),
  translatorName: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(2000).optional(),
  // A link that outlives the work is a link left lying around: the editor picks
  // one day, three days, or a week.
  lifetimeHours: z.coerce
    .number()
    .int()
    .refine((value) => [24, 72, 168].includes(value)),
});

export type TranslationRequest = z.infer<typeof requestFields>;

/** The translator, language and link lifetime, read straight from the form. */
export function parseTranslationRequest(
  formData: FormData,
): TranslationRequest {
  return requestFields.parse({
    targetLanguageCode: formData.get("targetLanguageCode"),
    translatorEmail: formData.get("translatorEmail"),
    translatorName: optionalFormValue(formData.get("translatorName")),
    instructions: optionalFormValue(formData.get("instructions")),
    lifetimeHours: formData.get("lifetimeHours"),
  });
}

const reviewFields = z.object({
  assignmentId: z.string().uuid(),
  decision: z.enum(["accept", "reject"]),
  reviewNote: z.string().trim().max(2000).optional(),
});

export type TranslationReview = z.infer<typeof reviewFields>;

/** The reviewer's decision and note, read straight from the form. */
export function parseTranslationReview(formData: FormData): TranslationReview {
  return reviewFields.parse({
    assignmentId: formData.get("assignmentId"),
    decision: formData.get("decision"),
    reviewNote: optionalFormValue(formData.get("reviewNote")),
  });
}

/** The newest source version of an entity — what a request pins itself to. */
function newestSourceVersion(
  tx: Transaction,
  kind: TranslationEntityKind,
  entityId: string,
) {
  return tx
    .select()
    .from(translationSourceVersions)
    .where(
      and(
        eq(translationSourceVersions.entityKind, kind),
        eq(translationSourceVersions.entityId, entityId),
      ),
    )
    .orderBy(desc(translationSourceVersions.version))
    .limit(1);
}

/**
 * Send one language of an entity to an external translator: pin the source,
 * reserve the language, and mail the expiring link.
 *
 * The caller has already checked that this editor may write to the entity, and
 * revalidates its own page afterwards — the paths differ per content type.
 */
export async function requestTranslation(input: {
  kind: TranslationEntityKind;
  entityId: string;
  request: TranslationRequest;
  actor: ActionUser;
  locale: Locale;
  /** Shown when the entity has no source text to translate yet. */
  missingSource: string;
  /**
   * The organisation the assignment belongs to. Defaults to the source
   * version's, which is right whenever the entity itself is owned by one.
   */
  organizationId?: string;
}) {
  const { kind, entityId, request, actor, locale } = input;
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(
    Date.now() + request.lifetimeHours * 60 * 60 * 1000,
  );

  const assignment = await db.transaction(async (tx) => {
    // Retire any elapsed predecessor so the one-live-assignment slot frees.
    await tx
      .update(translationAssignments)
      .set({ expiredAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(translationAssignments.entityKind, kind),
          eq(translationAssignments.entityId, entityId),
          eq(
            translationAssignments.targetLanguageCode,
            request.targetLanguageCode,
          ),
          isNull(translationAssignments.expiredAt),
          isNull(translationAssignments.revokedAt),
          lte(translationAssignments.expiresAt, new Date()),
        ),
      );

    const [sourceVersion] = await newestSourceVersion(tx, kind, entityId);
    if (!sourceVersion) throw new Error(input.missingSource);
    if (sourceVersion.sourceLanguageCode === request.targetLanguageCode) {
      throw new Error("The source language cannot be assigned as a target");
    }

    const [liveAssignment] = await tx
      .select({ id: translationAssignments.id })
      .from(translationAssignments)
      .where(
        and(
          eq(translationAssignments.entityKind, kind),
          eq(translationAssignments.entityId, entityId),
          eq(
            translationAssignments.targetLanguageCode,
            request.targetLanguageCode,
          ),
          isNull(translationAssignments.revokedAt),
          isNull(translationAssignments.expiredAt),
          gt(translationAssignments.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (liveAssignment) {
      throw new Error("This language already has an active assignment");
    }

    const [created] = await tx
      .insert(translationAssignments)
      .values({
        organizationId: input.organizationId ?? sourceVersion.organizationId,
        entityKind: kind,
        entityId,
        sourceVersionId: sourceVersion.id,
        targetLanguageCode: request.targetLanguageCode,
        translatorEmail: request.translatorEmail.toLowerCase(),
        translatorName: request.translatorName ?? null,
        assignedById: actor.id,
        tokenHash,
        instructions: request.instructions ?? null,
        expiresAt,
      })
      .returning({
        id: translationAssignments.id,
        organizationId: translationAssignments.organizationId,
      });
    if (!created) throw new Error("Translation assignment insert failed");
    await tx.insert(translationAssignmentEvents).values({
      assignmentId: created.id,
      toState: "requested",
      actorUserId: actor.id,
    });
    return created;
  });

  const url = new URL(
    `/${locale}/translate/${rawToken}`,
    env.SITE_URL,
  ).toString();
  try {
    await sendTranslationAssignmentEmail({
      email: request.translatorEmail,
      url,
      locale,
      language: request.targetLanguageCode,
      senderName: actor.name ?? actor.email ?? "InfoKit",
      expiresAt,
    });
  } catch (error) {
    // A link nobody received must not sit in the queue as an active job.
    await db
      .update(translationAssignments)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(translationAssignments.id, assignment.id));
    throw error;
  }
  await recordAudit({
    action: "translation.assignment.requested",
    subjectType: "translation_assignment",
    subjectId: assignment.id,
    organizationId: assignment.organizationId,
    metadata: {
      entityKind: kind,
      entityId,
      targetLanguageCode: request.targetLanguageCode,
    },
  });
}

/**
 * Accept or reject a submitted translation. The state transition, its trail and
 * the audit entry are the same for every content type; `promote` is the one part
 * that isn't, and it runs inside the same transaction so a target it refuses to
 * write leaves the assignment untouched.
 *
 * The caller has already checked that this editor may write to the entity, and
 * revalidates its own page afterwards.
 */
export async function reviewTranslation(input: {
  kind: TranslationEntityKind;
  entityId: string;
  review: TranslationReview;
  actor: ActionUser;
  /**
   * Reject a translation of a superseded source. Only for targets whose
   * translation row is not itself version-scoped: there, accepting late would
   * publish a translation of text nobody can read any more. Where the target row
   * hangs off the pinned revision, a later edit is simply a different revision,
   * so the translation stays correct where it lands.
   */
  staleSource?: string;
  promote: (
    tx: Transaction,
    assignment: TranslationAssignment,
    decidedAt: Date,
  ) => Promise<void>;
}) {
  const { kind, entityId, review, actor } = input;
  let organizationId: string | null = null;

  await db.transaction(async (tx) => {
    const [assignment] = await tx
      .select()
      .from(translationAssignments)
      .where(
        and(
          eq(translationAssignments.id, review.assignmentId),
          eq(translationAssignments.entityId, entityId),
          eq(translationAssignments.entityKind, kind),
        ),
      )
      .limit(1);
    if (assignment?.state !== "submitted") {
      throw new Error("This assignment is not awaiting review");
    }
    organizationId = assignment.organizationId;

    if (input.staleSource) {
      const [latestSource] = await newestSourceVersion(tx, kind, entityId);
      if (latestSource?.id !== assignment.sourceVersionId) {
        throw new Error(input.staleSource);
      }
    }

    const decidedAt = new Date();
    const nextState = review.decision === "accept" ? "accepted" : "rejected";
    await tx
      .update(translationAssignments)
      .set({
        state: nextState,
        reviewNote: review.reviewNote ?? null,
        reviewedById: actor.id,
        reviewedAt: decidedAt,
        decidedAt,
      })
      .where(eq(translationAssignments.id, assignment.id));
    // Two hops, not one: the trail should show it was read before it was judged.
    await tx.insert(translationAssignmentEvents).values([
      {
        assignmentId: assignment.id,
        fromState: "submitted",
        toState: "reviewed",
        actorUserId: actor.id,
        note: review.reviewNote ?? null,
      },
      {
        assignmentId: assignment.id,
        fromState: "reviewed",
        toState: nextState,
        actorUserId: actor.id,
        note: review.reviewNote ?? null,
      },
    ]);

    if (review.decision === "accept") {
      await input.promote(tx, assignment, decidedAt);
    }
  });

  await recordAudit({
    action: `translation.assignment.${review.decision === "accept" ? "accepted" : "rejected"}`,
    subjectType: "translation_assignment",
    subjectId: review.assignmentId,
    organizationId,
    metadata: { entityKind: kind, entityId },
  });
}
