"use server";

import { createHash, randomBytes } from "node:crypto";
import type { Locale } from "@infokit/shared/i18n";
import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { recordAudit } from "~/server/audit";
import { auth } from "~/server/auth";
import { sendTranslationAssignmentEmail } from "~/server/auth/aws";
import { assertOrganizationWritable } from "~/server/auth/org-access";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  organizationProfileTranslations,
  translationAssignmentEvents,
  translationAssignments,
  translationSourceVersions,
} from "~/server/db/schema";

/**
 * Translator collaboration for the organisation narrative (purpose, goals,
 * values). Same lifecycle as articles, activities, and simulator flows: the
 * request pins an immutable source version, the translator works behind an
 * expiring link, and only an accepted review reaches the public profile table.
 */

const languages = z.enum(editorialLanguageCodes);

function optionalFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function refresh(locale: Locale, organizationId: string) {
  revalidatePath(
    localizedPath(`/dashboard/organizations/${organizationId}`, locale),
  );
}

const requestSchema = z.object({
  organizationId: z.string().uuid(),
  targetLanguageCode: languages,
  translatorEmail: z.string().trim().email().max(255),
  translatorName: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(2000).optional(),
  lifetimeHours: z.coerce
    .number()
    .int()
    .refine((value) => [24, 72, 168].includes(value)),
});

export const requestOrganizationTranslation = protectedPermissionAction(
  "content.translation.request",
  async (formData, locale) => {
    const parsed = requestSchema.parse({
      organizationId: formData.get("organizationId"),
      targetLanguageCode: formData.get("targetLanguageCode"),
      translatorEmail: formData.get("translatorEmail"),
      translatorName: optionalFormValue(formData.get("translatorName")),
      instructions: optionalFormValue(formData.get("instructions")),
      lifetimeHours: formData.get("lifetimeHours"),
    });
    const session = await auth();
    if (!session?.user.id) throw new Error("A signed-in sender is required");
    await assertOrganizationWritable(session.user.id, parsed.organizationId);
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + parsed.lifetimeHours * 60 * 60 * 1000,
    );

    const assignment = await db.transaction(async (tx) => {
      await tx
        .update(translationAssignments)
        .set({ expiredAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(translationAssignments.entityKind, "organization_profile"),
            eq(translationAssignments.entityId, parsed.organizationId),
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
            eq(translationSourceVersions.entityKind, "organization_profile"),
            eq(translationSourceVersions.entityId, parsed.organizationId),
          ),
        )
        .orderBy(desc(translationSourceVersions.version))
        .limit(1);
      if (!sourceVersion) {
        throw new Error("The organisation has no narrative to translate yet");
      }
      if (sourceVersion.sourceLanguageCode === parsed.targetLanguageCode) {
        throw new Error("The source language cannot be assigned as a target");
      }
      const [liveAssignment] = await tx
        .select({ id: translationAssignments.id })
        .from(translationAssignments)
        .where(
          and(
            eq(translationAssignments.entityKind, "organization_profile"),
            eq(translationAssignments.entityId, parsed.organizationId),
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
          organizationId: parsed.organizationId,
          entityKind: "organization_profile",
          entityId: parsed.organizationId,
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
        senderName: session.user.name ?? session.user.email ?? "InfoKit",
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
      organizationId: parsed.organizationId,
      metadata: {
        entityKind: "organization_profile",
        entityId: parsed.organizationId,
        targetLanguageCode: parsed.targetLanguageCode,
      },
    });
    refresh(locale, parsed.organizationId);
  },
);

type SubmittedNarrative = {
  purpose?: unknown;
  goals?: unknown;
  values?: unknown;
};

const reviewSchema = z.object({
  assignmentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  decision: z.enum(["accept", "reject"]),
  reviewNote: z.string().trim().max(2000).optional(),
});

export const reviewOrganizationTranslation = protectedPermissionAction(
  "content.translation.review",
  async (formData, locale) => {
    const parsed = reviewSchema.parse({
      assignmentId: formData.get("assignmentId"),
      organizationId: formData.get("organizationId"),
      decision: formData.get("decision"),
      reviewNote: optionalFormValue(formData.get("reviewNote")),
    });
    const session = await auth();
    if (!session?.user.id) throw new Error("A signed-in reviewer is required");
    await assertOrganizationWritable(session.user.id, parsed.organizationId);

    await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select()
        .from(translationAssignments)
        .where(
          and(
            eq(translationAssignments.id, parsed.assignmentId),
            eq(translationAssignments.entityId, parsed.organizationId),
            eq(translationAssignments.entityKind, "organization_profile"),
          ),
        )
        .limit(1);
      if (assignment?.state !== "submitted") {
        throw new Error("This assignment is not awaiting review");
      }
      const [latestSource] = await tx
        .select({ id: translationSourceVersions.id })
        .from(translationSourceVersions)
        .where(
          and(
            eq(translationSourceVersions.entityKind, "organization_profile"),
            eq(translationSourceVersions.entityId, parsed.organizationId),
          ),
        )
        .orderBy(desc(translationSourceVersions.version))
        .limit(1);
      if (latestSource?.id !== assignment.sourceVersionId) {
        throw new Error(
          "The narrative changed after this translation was requested",
        );
      }

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
        const submitted =
          assignment.submittedContentJson as SubmittedNarrative | null;
        const purpose =
          typeof submitted?.purpose === "string"
            ? submitted.purpose.trim()
            : "";
        if (!purpose) {
          throw new Error("The submitted translation has no purpose text");
        }
        const goals =
          typeof submitted?.goals === "string"
            ? submitted.goals.trim() || null
            : null;
        const values =
          typeof submitted?.values === "string"
            ? submitted.values.trim() || null
            : null;
        await tx
          .insert(organizationProfileTranslations)
          .values({
            organizationId: parsed.organizationId,
            languageCode: assignment.targetLanguageCode,
            purpose,
            goals,
            values,
            state: "verified",
            method: "human",
          })
          .onConflictDoUpdate({
            target: [
              organizationProfileTranslations.organizationId,
              organizationProfileTranslations.languageCode,
            ],
            set: { purpose, goals, values, state: "verified", method: "human" },
          });
      }
    });

    await recordAudit({
      action: `translation.assignment.${parsed.decision === "accept" ? "accepted" : "rejected"}`,
      subjectType: "translation_assignment",
      subjectId: parsed.assignmentId,
      organizationId: parsed.organizationId,
      metadata: {
        entityKind: "organization_profile",
        entityId: parsed.organizationId,
      },
    });
    refresh(locale, parsed.organizationId);
  },
);
