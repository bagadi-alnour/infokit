"use server";

import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRouteLocale } from "~/i18n/route-locale";
import { db } from "~/server/db";
import {
  translationAssignmentEvents,
  translationAssignments,
  translationSourceVersions,
} from "~/server/db/schema";
import { readTranslationAssignmentSession } from "~/server/translation-assignment-session";

const intentSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  entityKind: z
    .enum(["standard", "simulator_flow", "organization_profile"])
    .default("standard"),
  intent: z.enum(["draft", "submit"]),
});

const standardSchema = z.object({
  title: z.string().trim().max(200),
  summary: z.string().trim().max(2000),
  body: z.string().trim().max(40_000),
});

/** The organisation narrative: purpose is what the public profile needs. */
const narrativeSchema = z.object({
  purpose: z.string().trim().max(4000),
  goals: z.string().trim().max(4000),
  values: z.string().trim().max(4000),
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[character] ?? character;
  });
}

function paragraphs(value: string): string | null {
  if (!value) return null;
  return value
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

function simulatorSubmission(
  formData: FormData,
  sourceContent: unknown,
  requireComplete: boolean,
) {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const source = sourceContent as {
    simulator?: {
      nodes?: Array<{
        key?: unknown;
        options?: Array<{ key?: unknown }>;
      }>;
    };
  };
  const sourceNodes = source.simulator?.nodes ?? [];
  const nodes = sourceNodes.map((node, nodeIndex) => {
    const prompt = field(`simulator_node_${String(nodeIndex)}_prompt`);
    if (requireComplete && !prompt) {
      throw new Error("Every translated step needs a heading");
    }
    return {
      key: typeof node.key === "string" ? node.key : "",
      prompt,
      explanation: field(`simulator_node_${String(nodeIndex)}_explanation`),
      resultBody: field(`simulator_node_${String(nodeIndex)}_resultBody`),
      disclaimer: field(`simulator_node_${String(nodeIndex)}_disclaimer`),
      options: (node.options ?? []).map((option, optionIndex) => {
        const label = field(
          `simulator_node_${String(nodeIndex)}_option_${String(optionIndex)}`,
        );
        if (requireComplete && !label) {
          throw new Error("Every translated choice needs a label");
        }
        return {
          key: typeof option.key === "string" ? option.key : "",
          label,
        };
      }),
    };
  });
  return { simulator: { nodes } };
}

export async function saveExternalTranslation(formData: FormData) {
  const intent = intentSchema.parse({
    locale: formData.get("locale"),
    entityKind: formData.get("entityKind") ?? "standard",
    intent: formData.get("intent"),
  });
  const locale = requireRouteLocale(intent.locale);
  const assignmentId = await readTranslationAssignmentSession();
  if (!assignmentId) throw new Error("Translation session unavailable");

  await db.transaction(async (tx) => {
    const [assignment] = await tx
      .select({
        state: translationAssignments.state,
        entityKind: translationAssignments.entityKind,
        sourceContent: translationSourceVersions.sourceContentJson,
      })
      .from(translationAssignments)
      .innerJoin(
        translationSourceVersions,
        eq(
          translationSourceVersions.id,
          translationAssignments.sourceVersionId,
        ),
      )
      .where(
        and(
          eq(translationAssignments.id, assignmentId),
          isNull(translationAssignments.revokedAt),
          gt(translationAssignments.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!assignment || !["requested", "draft"].includes(assignment.state)) {
      throw new Error("This assignment can no longer be edited");
    }

    let content: unknown;
    if (
      intent.entityKind === "simulator_flow" &&
      assignment.entityKind === "simulator_flow"
    ) {
      content = simulatorSubmission(
        formData,
        assignment.sourceContent,
        intent.intent === "submit",
      );
    } else if (
      intent.entityKind === "organization_profile" &&
      assignment.entityKind === "organization_profile"
    ) {
      const parsed = narrativeSchema.parse({
        purpose: formData.get("purpose"),
        goals: formData.get("goals"),
        values: formData.get("values"),
      });
      if (intent.intent === "submit" && !parsed.purpose) {
        throw new Error("The purpose is required before submission");
      }
      content = {
        purpose: parsed.purpose,
        goals: parsed.goals || null,
        values: parsed.values || null,
      };
    } else {
      const parsed = standardSchema.parse({
        title: formData.get("title"),
        summary: formData.get("summary"),
        body: formData.get("body"),
      });
      if (intent.intent === "submit" && !parsed.title) {
        throw new Error("A title is required before submission");
      }
      content = {
        title: parsed.title,
        summary: parsed.summary || null,
        bodyHtml: paragraphs(parsed.body),
        plainText: parsed.body || null,
      };
    }

    const contentHash = createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex");
    const nextState = intent.intent === "submit" ? "submitted" : "draft";
    await tx
      .update(translationAssignments)
      .set({
        submittedContentJson: content,
        submittedContentHash: contentHash,
        state: nextState,
        submittedAt: nextState === "submitted" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(translationAssignments.id, assignmentId));
    await tx.insert(translationAssignmentEvents).values({
      assignmentId,
      fromState: assignment.state,
      toState: nextState,
      byTranslator: true,
    });
  });
  revalidatePath(`/${locale}/translate/assignment`);
}
