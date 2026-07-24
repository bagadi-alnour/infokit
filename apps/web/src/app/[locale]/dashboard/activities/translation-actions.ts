"use server";

import { createHash, randomBytes } from "node:crypto";
import type { Locale } from "@calais/shared/i18n";
import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { recordAudit } from "~/server/audit";
import { auth } from "~/server/auth";
import { sendTranslationAssignmentEmail } from "~/server/auth/aws";
import { hashContent } from "~/server/content/editorial";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activityTranslations,
  translationAssignmentEvents,
  translationAssignments,
  translationSourceVersions,
} from "~/server/db/schema";

const languages = z.enum(editorialLanguageCodes);

function optionalFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function refresh(locale: Locale, activityId: string) {
  revalidatePath(
    `${localizedPath("/dashboard/activities", locale)}?activity=${activityId}`,
  );
}

const requestSchema = z.object({
  activityId: z.string().uuid(),
  targetLanguageCode: languages,
  translatorEmail: z.string().trim().email().max(255),
  translatorName: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(2000).optional(),
  lifetimeHours: z.coerce
    .number()
    .int()
    .refine((value) => [24, 72, 168].includes(value)),
});

/**
 * Send one activity language to an external translator. Mirrors
 * `requestArticleTranslation` but pins to an `activity` source version and
 * reuses the generic translator link/session flow.
 */
export const requestActivityTranslation = protectedPermissionAction(
  "content.translation.request",
  async (formData, locale) => {
    const parsed = requestSchema.parse({
      activityId: formData.get("activityId"),
      targetLanguageCode: formData.get("targetLanguageCode"),
      translatorEmail: formData.get("translatorEmail"),
      translatorName: optionalFormValue(formData.get("translatorName")),
      instructions: optionalFormValue(formData.get("instructions")),
      lifetimeHours: formData.get("lifetimeHours"),
    });
    const session = await auth();
    if (!session?.user.id) throw new Error("A signed-in sender is required");

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + parsed.lifetimeHours * 60 * 60 * 1000,
    );

    const assignment = await db.transaction(async (tx) => {
      // Retire any elapsed predecessor so the one-live-assignment slot frees.
      await tx
        .update(translationAssignments)
        .set({ expiredAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(translationAssignments.entityKind, "activity"),
            eq(translationAssignments.entityId, parsed.activityId),
            eq(
              translationAssignments.targetLanguageCode,
              parsed.targetLanguageCode,
            ),
            isNull(translationAssignments.expiredAt),
            isNull(translationAssignments.revokedAt),
            lte(translationAssignments.expiresAt, new Date()),
          ),
        );
      const [sourceVersion] = await tx
        .select()
        .from(translationSourceVersions)
        .where(
          and(
            eq(translationSourceVersions.entityKind, "activity"),
            eq(translationSourceVersions.entityId, parsed.activityId),
          ),
        )
        .orderBy(desc(translationSourceVersions.version))
        .limit(1);
      if (!sourceVersion) throw new Error("Activity has no translation source");
      if (sourceVersion.sourceLanguageCode === parsed.targetLanguageCode) {
        throw new Error("The source language cannot be assigned as a target");
      }

      const [liveAssignment] = await tx
        .select({ id: translationAssignments.id })
        .from(translationAssignments)
        .where(
          and(
            eq(translationAssignments.entityKind, "activity"),
            eq(translationAssignments.entityId, parsed.activityId),
            eq(
              translationAssignments.targetLanguageCode,
              parsed.targetLanguageCode,
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
          organizationId: sourceVersion.organizationId,
          entityKind: "activity",
          entityId: parsed.activityId,
          sourceVersionId: sourceVersion.id,
          targetLanguageCode: parsed.targetLanguageCode,
          translatorEmail: parsed.translatorEmail.toLowerCase(),
          translatorName: parsed.translatorName ?? null,
          assignedById: session.user.id,
          tokenHash,
          instructions: parsed.instructions ?? null,
          expiresAt,
        })
        .returning({ id: translationAssignments.id });
      if (!created) throw new Error("Translation assignment insert failed");
      await tx.insert(translationAssignmentEvents).values({
        assignmentId: created.id,
        toState: "requested",
        actorUserId: session.user.id,
      });
      return created;
    });

    const url = new URL(
      `/${locale}/translate/${rawToken}`,
      env.SITE_URL,
    ).toString();
    try {
      await sendTranslationAssignmentEmail({
        email: parsed.translatorEmail,
        url,
        locale,
        language: parsed.targetLanguageCode,
        senderName: session.user.name ?? session.user.email ?? "Calais Info",
        expiresAt,
      });
    } catch (error) {
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
      metadata: {
        entityId: parsed.activityId,
        targetLanguageCode: parsed.targetLanguageCode,
      },
    });
    refresh(locale, parsed.activityId);
  },
);

const reviewSchema = z.object({
  assignmentId: z.string().uuid(),
  activityId: z.string().uuid(),
  decision: z.enum(["accept", "reject"]),
  reviewNote: z.string().trim().max(2000).optional(),
});

type SubmittedTranslation = {
  title?: unknown;
  summary?: unknown;
  bodyHtml?: unknown;
  plainText?: unknown;
};

/**
 * Accept or reject a submitted activity translation. Accepting promotes the
 * translator's text into the verified `activity_translations` row, still
 * pinned to the assignment's immutable source version.
 */
export const reviewActivityTranslation = protectedPermissionAction(
  "content.translation.review",
  async (formData, locale) => {
    const parsed = reviewSchema.parse({
      assignmentId: formData.get("assignmentId"),
      activityId: formData.get("activityId"),
      decision: formData.get("decision"),
      reviewNote: optionalFormValue(formData.get("reviewNote")),
    });
    const session = await auth();
    if (!session?.user.id) throw new Error("A signed-in reviewer is required");

    await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select()
        .from(translationAssignments)
        .where(
          and(
            eq(translationAssignments.id, parsed.assignmentId),
            eq(translationAssignments.entityId, parsed.activityId),
            eq(translationAssignments.entityKind, "activity"),
          ),
        )
        .limit(1);
      if (assignment?.state !== "submitted") {
        throw new Error("This assignment is not awaiting review");
      }
      const submitted =
        assignment.submittedContentJson as SubmittedTranslation | null;
      const name =
        typeof submitted?.title === "string" ? submitted.title.trim() : "";
      const summary =
        typeof submitted?.summary === "string" ? submitted.summary.trim() : "";
      const descriptionHtml =
        typeof submitted?.bodyHtml === "string" ? submitted.bodyHtml : "";
      const descriptionText =
        typeof submitted?.plainText === "string" ? submitted.plainText : "";
      if (!name) throw new Error("The submitted translation has no title");

      const decidedAt = new Date();
      const nextState = parsed.decision === "accept" ? "accepted" : "rejected";
      await tx
        .update(translationAssignments)
        .set({
          state: nextState,
          reviewNote: parsed.reviewNote ?? null,
          reviewedById: session.user.id,
          reviewedAt: decidedAt,
          decidedAt,
        })
        .where(eq(translationAssignments.id, assignment.id));
      await tx.insert(translationAssignmentEvents).values([
        {
          assignmentId: assignment.id,
          fromState: "submitted",
          toState: "reviewed",
          actorUserId: session.user.id,
          note: parsed.reviewNote ?? null,
        },
        {
          assignmentId: assignment.id,
          fromState: "reviewed",
          toState: nextState,
          actorUserId: session.user.id,
          note: parsed.reviewNote ?? null,
        },
      ]);

      if (parsed.decision === "accept") {
        const shortDescription =
          summary || (descriptionText ? descriptionText.slice(0, 500) : null);
        const contentHash = hashContent({
          languageCode: assignment.targetLanguageCode,
          title: name,
          descriptionHtml: descriptionHtml || null,
          descriptionText: descriptionText || null,
        });
        await tx
          .insert(activityTranslations)
          .values({
            activityId: parsed.activityId,
            languageCode: assignment.targetLanguageCode,
            name,
            descriptionHtml: descriptionHtml || null,
            descriptionText: descriptionText || null,
            shortDescription,
            state: "verified",
            method: "human",
            sourceVersionId: assignment.sourceVersionId,
            contentHash,
            verifiedById: session.user.id,
            verifiedAt: decidedAt,
          })
          .onConflictDoUpdate({
            target: [
              activityTranslations.activityId,
              activityTranslations.languageCode,
            ],
            set: {
              name,
              descriptionHtml: descriptionHtml || null,
              descriptionText: descriptionText || null,
              shortDescription,
              state: "verified",
              method: "human",
              sourceVersionId: assignment.sourceVersionId,
              contentHash,
              verifiedById: session.user.id,
              verifiedAt: decidedAt,
            },
          });
      }
    });
    await recordAudit({
      action: `translation.assignment.${parsed.decision === "accept" ? "accepted" : "rejected"}`,
      subjectType: "translation_assignment",
      subjectId: parsed.assignmentId,
      metadata: { entityId: parsed.activityId },
    });
    refresh(locale, parsed.activityId);
  },
);
