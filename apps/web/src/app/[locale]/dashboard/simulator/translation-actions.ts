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
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  flowVersions,
  nodes,
  nodeTranslations,
  options,
  optionTranslations,
  translationAssignmentEvents,
  translationAssignments,
  translationSourceVersions,
} from "~/server/db/schema";

const languages = z.enum(editorialLanguageCodes);

function optionalFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function refresh(locale: Locale, flowId: string) {
  revalidatePath(localizedPath(`/dashboard/simulator/${flowId}`, locale));
}

const requestSchema = z.object({
  flowId: z.string().uuid(),
  targetLanguageCode: languages,
  translatorEmail: z.string().trim().email().max(255),
  translatorName: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(2000).optional(),
  lifetimeHours: z.coerce
    .number()
    .int()
    .refine((value) => [24, 72, 168].includes(value)),
});

export const requestSimulatorTranslation = protectedPermissionAction(
  "content.translation.request",
  async (formData, locale) => {
    const parsed = requestSchema.parse({
      flowId: formData.get("flowId"),
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
      await tx
        .update(translationAssignments)
        .set({ expiredAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(translationAssignments.entityKind, "simulator_flow"),
            eq(translationAssignments.entityId, parsed.flowId),
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
            eq(translationSourceVersions.entityKind, "simulator_flow"),
            eq(translationSourceVersions.entityId, parsed.flowId),
          ),
        )
        .orderBy(desc(translationSourceVersions.version))
        .limit(1);
      if (!sourceVersion) {
        throw new Error("The simulator has no translation source");
      }
      if (sourceVersion.sourceLanguageCode === parsed.targetLanguageCode) {
        throw new Error("The source language cannot be assigned as a target");
      }
      const [liveAssignment] = await tx
        .select({ id: translationAssignments.id })
        .from(translationAssignments)
        .where(
          and(
            eq(translationAssignments.entityKind, "simulator_flow"),
            eq(translationAssignments.entityId, parsed.flowId),
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
          entityKind: "simulator_flow",
          entityId: parsed.flowId,
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
        entityId: parsed.flowId,
        targetLanguageCode: parsed.targetLanguageCode,
      },
    });
    refresh(locale, parsed.flowId);
  },
);

type SubmittedSimulator = {
  simulator?: {
    nodes?: Array<{
      key?: unknown;
      prompt?: unknown;
      explanation?: unknown;
      resultBody?: unknown;
      disclaimer?: unknown;
      options?: Array<{ key?: unknown; label?: unknown }>;
    }>;
  };
};

const reviewSchema = z.object({
  assignmentId: z.string().uuid(),
  flowId: z.string().uuid(),
  decision: z.enum(["accept", "reject"]),
  reviewNote: z.string().trim().max(2000).optional(),
});

export const reviewSimulatorTranslation = protectedPermissionAction(
  "content.translation.review",
  async (formData, locale) => {
    const parsed = reviewSchema.parse({
      assignmentId: formData.get("assignmentId"),
      flowId: formData.get("flowId"),
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
            eq(translationAssignments.entityId, parsed.flowId),
            eq(translationAssignments.entityKind, "simulator_flow"),
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
            eq(translationSourceVersions.entityKind, "simulator_flow"),
            eq(translationSourceVersions.entityId, parsed.flowId),
          ),
        )
        .orderBy(desc(translationSourceVersions.version))
        .limit(1);
      if (latestSource?.id !== assignment.sourceVersionId) {
        throw new Error(
          "The simulator changed after this translation was requested",
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
          assignment.submittedContentJson as SubmittedSimulator | null;
        const submittedNodes = submitted?.simulator?.nodes;
        if (!submittedNodes?.length) {
          throw new Error("The submitted simulator translation is empty");
        }
        const [draftVersion] = await tx
          .select({ id: flowVersions.id })
          .from(flowVersions)
          .where(
            and(
              eq(flowVersions.flowId, parsed.flowId),
              eq(flowVersions.status, "draft"),
            ),
          )
          .orderBy(desc(flowVersions.versionNumber))
          .limit(1);
        if (!draftVersion)
          throw new Error("The simulator draft is unavailable");
        const nodeRows = await tx
          .select({ id: nodes.id, key: nodes.nodeKey })
          .from(nodes)
          .where(eq(nodes.versionId, draftVersion.id));
        const nodeByKey = new Map(nodeRows.map((node) => [node.key, node.id]));

        for (const submittedNode of submittedNodes) {
          const key =
            typeof submittedNode.key === "string" ? submittedNode.key : "";
          const nodeId = nodeByKey.get(key);
          if (!nodeId) throw new Error("A translated step no longer exists");
          const prompt =
            typeof submittedNode.prompt === "string"
              ? submittedNode.prompt.trim()
              : "";
          if (!prompt) throw new Error("Every translated step needs a heading");
          await tx
            .insert(nodeTranslations)
            .values({
              nodeId,
              languageCode: assignment.targetLanguageCode,
              prompt,
              explanation:
                typeof submittedNode.explanation === "string"
                  ? submittedNode.explanation.trim() || null
                  : null,
              resultBody:
                typeof submittedNode.resultBody === "string"
                  ? submittedNode.resultBody.trim() || null
                  : null,
              disclaimer:
                typeof submittedNode.disclaimer === "string"
                  ? submittedNode.disclaimer.trim() || null
                  : null,
              state: "verified",
            })
            .onConflictDoUpdate({
              target: [nodeTranslations.nodeId, nodeTranslations.languageCode],
              set: {
                prompt,
                explanation:
                  typeof submittedNode.explanation === "string"
                    ? submittedNode.explanation.trim() || null
                    : null,
                resultBody:
                  typeof submittedNode.resultBody === "string"
                    ? submittedNode.resultBody.trim() || null
                    : null,
                disclaimer:
                  typeof submittedNode.disclaimer === "string"
                    ? submittedNode.disclaimer.trim() || null
                    : null,
                state: "verified",
              },
            });

          const optionRows = await tx
            .select({ id: options.id, key: options.optionKey })
            .from(options)
            .where(eq(options.nodeId, nodeId));
          const optionByKey = new Map(
            optionRows.map((option) => [option.key, option.id]),
          );
          for (const submittedOption of submittedNode.options ?? []) {
            const optionKey =
              typeof submittedOption.key === "string"
                ? submittedOption.key
                : "";
            const optionId = optionByKey.get(optionKey);
            const label =
              typeof submittedOption.label === "string"
                ? submittedOption.label.trim()
                : "";
            if (!optionId || !label) {
              throw new Error("A translated choice is incomplete");
            }
            await tx
              .insert(optionTranslations)
              .values({
                optionId,
                languageCode: assignment.targetLanguageCode,
                label,
                state: "verified",
              })
              .onConflictDoUpdate({
                target: [
                  optionTranslations.optionId,
                  optionTranslations.languageCode,
                ],
                set: { label, state: "verified" },
              });
          }
        }
      }
    });

    await recordAudit({
      action: `translation.assignment.${parsed.decision === "accept" ? "accepted" : "rejected"}`,
      subjectType: "translation_assignment",
      subjectId: parsed.assignmentId,
      metadata: { entityId: parsed.flowId },
    });
    refresh(locale, parsed.flowId);
  },
);
