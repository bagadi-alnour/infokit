"use server";

import { type Locale } from "@infokit/shared/i18n";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { protectedPermissionAction } from "~/server/auth/require";
import {
  parseTranslationRequest,
  parseTranslationReview,
  requestTranslation,
  reviewTranslation,
} from "~/server/content/translation-assignments";
import {
  flowVersions,
  nodes,
  nodeTranslations,
  options,
  optionTranslations,
} from "~/server/db/schema";

/**
 * Translator collaboration for simulator guides. The lifecycle itself lives in
 * `~/server/content/translation-assignments`; what belongs here is promoting an
 * accepted translation back onto the graph it came from — every step and every
 * choice, matched by the stable keys the translator saw.
 */

const ENTITY = "simulator_flow" as const;
const flowId = z.string().uuid();

function refresh(locale: Locale, id: string) {
  revalidatePath(localizedPath(`/dashboard/simulator/${id}`, locale));
}

export const requestSimulatorTranslation = protectedPermissionAction(
  "content.translation.request",
  async (formData, locale, user) => {
    const id = flowId.parse(formData.get("flowId"));
    await requestTranslation({
      kind: ENTITY,
      entityId: id,
      request: parseTranslationRequest(formData),
      actor: user,
      locale,
      missingSource: "The simulator has no translation source",
    });
    refresh(locale, id);
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

/** Trimmed text, or null — the translator left the field empty. */
function trimmedOrNull(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

export const reviewSimulatorTranslation = protectedPermissionAction(
  "content.translation.review",
  async (formData, locale, user) => {
    const id = flowId.parse(formData.get("flowId"));
    await reviewTranslation({
      kind: ENTITY,
      entityId: id,
      review: parseTranslationReview(formData),
      actor: user,
      // Step and choice translations are keyed by the row, not by a version, so
      // a late acceptance would attach text to a graph that has since changed.
      staleSource: "The simulator changed after this translation was requested",
      promote: async (tx, assignment) => {
        const languageCode = assignment.targetLanguageCode;
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
            and(eq(flowVersions.flowId, id), eq(flowVersions.status, "draft")),
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
          const step = {
            prompt,
            explanation: trimmedOrNull(submittedNode.explanation),
            resultBody: trimmedOrNull(submittedNode.resultBody),
            disclaimer: trimmedOrNull(submittedNode.disclaimer),
            state: "verified" as const,
          };
          await tx
            .insert(nodeTranslations)
            .values({ nodeId, languageCode, ...step })
            .onConflictDoUpdate({
              target: [nodeTranslations.nodeId, nodeTranslations.languageCode],
              set: step,
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
              .values({ optionId, languageCode, label, state: "verified" })
              .onConflictDoUpdate({
                target: [
                  optionTranslations.optionId,
                  optionTranslations.languageCode,
                ],
                set: { label, state: "verified" },
              });
          }
        }
      },
    });
    refresh(locale, id);
  },
);
