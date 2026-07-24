"use server";

import type { Locale } from "@calais/shared/i18n";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { auth } from "~/server/auth";
import { protectedPermissionAction } from "~/server/auth/require";
import { hashContent, slugify } from "~/server/content/editorial";
import { db } from "~/server/db";
import {
  edges,
  flows,
  flowVersions,
  nodes,
  nodeTranslations,
  options,
  optionTranslations,
  translationSourceVersions,
  versionPublications,
} from "~/server/db/schema";

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.string().uuid().nullable());

function refresh(locale: Locale, flowId?: string) {
  revalidatePath(localizedPath("/dashboard/simulator", locale));
  if (flowId) {
    revalidatePath(localizedPath(`/dashboard/simulator/${flowId}`, locale));
  }
}

function refreshPublicSimulator(slug: string) {
  for (const language of ["fr", "en", "ar"] as const) {
    revalidatePath(localizedPath(`/simulator/${slug}`, language));
  }
}

async function uniqueFlowSlug(desired: string) {
  const base = slugify(desired);
  let candidate = base;
  for (let suffix = 2; suffix < 50; suffix += 1) {
    const [existing] = await db
      .select({ id: flows.id })
      .from(flows)
      .where(eq(flows.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base.slice(0, 140)}-${String(suffix)}`;
  }
  return `${base.slice(0, 130)}-${crypto.randomUUID().slice(0, 8)}`;
}

const createFlowSchema = z.object({
  internalName: z.string().trim().min(2).max(180),
  organizationId: optionalUuid,
  cityId: optionalUuid,
  sourceLanguage: z.enum(["fr", "en", "ar"]).default("fr"),
  sourceSummary: z.string().trim().min(10).max(4000),
  initialPrompt: z.string().trim().min(2).max(2000),
  initialExplanation: z.string().trim().max(4000),
  lastReviewedDate: z.string().date(),
  reviewDueDate: z.string().date(),
});

export const createSimulatorFlow = protectedPermissionAction(
  "content.simulator.review",
  async (formData, locale) => {
    const parsed = createFlowSchema.parse({
      internalName: formData.get("internalName"),
      organizationId: formData.get("organizationId") ?? "",
      cityId: formData.get("cityId") ?? "",
      sourceLanguage: formData.get("sourceLanguage") ?? "fr",
      sourceSummary: formData.get("sourceSummary"),
      initialPrompt: formData.get("initialPrompt"),
      initialExplanation: formData.get("initialExplanation"),
      lastReviewedDate: formData.get("lastReviewedDate"),
      reviewDueDate: formData.get("reviewDueDate"),
    });
    if (parsed.reviewDueDate < parsed.lastReviewedDate) {
      throw new Error("The next review cannot be before the last review");
    }
    const session = await auth();
    const actorId = session?.user.id;
    if (!actorId) throw new Error("Authentication required");
    const slug = await uniqueFlowSlug(parsed.internalName);

    const created = await db.transaction(async (tx) => {
      const [flow] = await tx
        .insert(flows)
        .values({
          slug,
          internalName: parsed.internalName,
          ownerOrganizationId: parsed.organizationId,
          cityId: parsed.cityId,
        })
        .returning({ id: flows.id });
      if (!flow) throw new Error("Flow insert returned no row");

      const [version] = await tx
        .insert(flowVersions)
        .values({
          flowId: flow.id,
          versionNumber: 1,
          entryNodeKey: "start",
          sourceLanguageCode: parsed.sourceLanguage,
          sourceSummary: parsed.sourceSummary,
          lastReviewedAt: new Date(`${parsed.lastReviewedDate}T12:00:00Z`),
          reviewDueAt: new Date(`${parsed.reviewDueDate}T12:00:00Z`),
        })
        .returning({ id: flowVersions.id });
      if (!version) throw new Error("Flow version insert returned no row");

      const [startNode] = await tx
        .insert(nodes)
        .values({
          versionId: version.id,
          nodeKey: "start",
          kind: "question",
          optional: true,
          positionX: 80,
          positionY: 100,
        })
        .returning({ id: nodes.id });
      if (!startNode) throw new Error("Start node insert returned no row");

      await tx.insert(nodeTranslations).values({
        nodeId: startNode.id,
        languageCode: parsed.sourceLanguage,
        prompt: parsed.initialPrompt,
        explanation: parsed.initialExplanation || null,
        resultBody: null,
        disclaimer: null,
        state: "draft",
      });
      const sourcePayload = {
        sourceLanguage: parsed.sourceLanguage,
        translations: {
          [parsed.sourceLanguage]: {
            title: parsed.internalName,
            summary: parsed.sourceSummary,
            plainText: [parsed.initialPrompt, parsed.initialExplanation]
              .filter(Boolean)
              .join("\n\n"),
          },
        },
        simulator: {
          nodes: [
            {
              key: "start",
              kind: "question",
              optional: true,
              prompt: parsed.initialPrompt,
              explanation: parsed.initialExplanation,
              resultBody: "",
              disclaimer: "",
              options: [],
            },
          ],
        },
      };
      await tx.insert(translationSourceVersions).values({
        organizationId: parsed.organizationId,
        entityKind: "simulator_flow",
        entityId: flow.id,
        version: 1,
        sourceLanguageCode: parsed.sourceLanguage,
        sourceContentJson: sourcePayload,
        sourceContentHash: hashContent(sourcePayload),
        impact: "initial",
        createdById: actorId,
      });
      return { flowId: flow.id, versionId: version.id };
    });

    await recordAudit({
      action: "simulator.flow_created",
      subjectType: "simulator_flow",
      subjectId: created.flowId,
      organizationId: parsed.organizationId,
      metadata: {
        versionId: created.versionId,
        sourceLanguage: parsed.sourceLanguage,
      },
    });
    refresh(locale, created.flowId);
    redirect(localizedPath(`/dashboard/simulator/${created.flowId}`, locale));
  },
);

const translationSchema = z.object({
  prompt: z.string().max(2000),
  explanation: z.string().max(4000),
  resultBody: z.string().max(12000),
  disclaimer: z.string().max(4000),
});

const graphNodeSchema = z.object({
  id: z.string().min(1).max(100),
  key: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
  kind: z.enum(["question", "information", "result"]),
  optional: z.boolean(),
  position: z.object({
    x: z.number().finite().min(-100000).max(100000),
    y: z.number().finite().min(-100000).max(100000),
  }),
  translations: z.object({
    fr: translationSchema,
    en: translationSchema,
    ar: translationSchema,
  }),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        key: z
          .string()
          .trim()
          .min(1)
          .max(50)
          .regex(/^[a-z0-9][a-z0-9_-]*$/),
        preferNotToSay: z.boolean(),
        labels: z.object({
          fr: z.string().max(200),
          en: z.string().max(200),
          ar: z.string().max(200),
        }),
      }),
    )
    .max(20),
});

const graphSchema = z.object({
  internalName: z.string().trim().min(2).max(180),
  entryNodeId: z.string().min(1).max(100),
  sourceSummary: z.string().trim().max(4000),
  lastReviewedAt: z.string().datetime().nullable(),
  reviewDueAt: z.string().datetime().nullable(),
  nodes: z.array(graphNodeSchema).min(1).max(100),
  edges: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        source: z.string().min(1).max(100),
        target: z.string().min(1).max(100),
        sourceHandle: z.string().max(150).nullable(),
      }),
    )
    .max(300),
});

type SimulatorGraph = z.infer<typeof graphSchema>;

function simulatorSourcePayload(
  graph: SimulatorGraph,
  sourceLanguage: "fr" | "en" | "ar",
) {
  const sourceNodes = graph.nodes.map((node) => {
    const translation = node.translations[sourceLanguage];
    return {
      key: node.key,
      kind: node.kind,
      optional: node.optional,
      prompt: translation.prompt,
      explanation: translation.explanation,
      resultBody: translation.resultBody,
      disclaimer: translation.disclaimer,
      options: node.options.map((option) => ({
        key: option.key,
        preferNotToSay: option.preferNotToSay,
        label: option.labels[sourceLanguage],
      })),
    };
  });
  return {
    sourceLanguage,
    translations: {
      [sourceLanguage]: {
        title: graph.internalName,
        summary: graph.sourceSummary,
        plainText: sourceNodes
          .flatMap((node) => [
            node.prompt,
            node.explanation,
            node.resultBody,
            node.disclaimer,
            ...node.options.map((option) => option.label),
          ])
          .filter(Boolean)
          .join("\n\n"),
      },
    },
    simulator: { nodes: sourceNodes },
  };
}

const saveSchema = z.object({
  flowId: z.string().uuid(),
  versionId: z.string().uuid(),
  graph: z.string().max(1_000_000),
});

export const saveSimulatorDraft = protectedPermissionAction(
  "content.simulator.review",
  async (formData, locale) => {
    const input = saveSchema.parse({
      flowId: formData.get("flowId"),
      versionId: formData.get("versionId"),
      graph: formData.get("graph"),
    });
    const graph = graphSchema.parse(JSON.parse(input.graph) as unknown);
    const session = await auth();
    const actorId = session?.user.id;
    if (!actorId) throw new Error("Authentication required");
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    if (!nodeIds.has(graph.entryNodeId)) {
      throw new Error("The start step no longer exists");
    }
    if (
      new Set(graph.nodes.map((node) => node.key)).size !== graph.nodes.length
    ) {
      throw new Error("Every step needs a unique key");
    }
    for (const node of graph.nodes) {
      if (
        new Set(node.options.map((option) => option.key)).size !==
        node.options.length
      ) {
        throw new Error("Every choice in a step needs a unique key");
      }
      if (node.kind !== "question" && node.options.length > 0) {
        throw new Error("Only question steps can contain choices");
      }
    }
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const usedBranches = new Set<string>();
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new Error("A connection points to a missing step");
      }
      const sourceNode = nodeById.get(edge.source);
      if (!sourceNode || sourceNode.kind === "result") {
        throw new Error("A result step cannot have an onward connection");
      }
      const optionClientId = edge.sourceHandle?.startsWith("option:")
        ? edge.sourceHandle.slice("option:".length)
        : null;
      if (
        sourceNode.kind === "question" &&
        (!optionClientId ||
          !sourceNode.options.some((option) => option.id === optionClientId))
      ) {
        throw new Error(
          "A question connection must begin at one of its choices",
        );
      }
      const branchKey = `${edge.source}:${edge.sourceHandle ?? "next"}`;
      if (usedBranches.has(branchKey)) {
        throw new Error("Each choice can connect to only one next step");
      }
      usedBranches.add(branchKey);
    }

    await db.transaction(async (tx) => {
      const [version] = await tx
        .select({
          id: flowVersions.id,
          status: flowVersions.status,
          flowId: flowVersions.flowId,
          sourceLanguage: flowVersions.sourceLanguageCode,
          organizationId: flows.ownerOrganizationId,
        })
        .from(flowVersions)
        .innerJoin(flows, eq(flows.id, flowVersions.flowId))
        .where(
          and(
            eq(flowVersions.id, input.versionId),
            eq(flowVersions.flowId, input.flowId),
          ),
        )
        .limit(1);
      if (version?.status !== "draft") {
        throw new Error("Only a draft simulator version can be edited");
      }
      if (
        version.sourceLanguage !== "fr" &&
        version.sourceLanguage !== "en" &&
        version.sourceLanguage !== "ar"
      ) {
        throw new Error("The simulator source language is unsupported");
      }

      const sourcePayload = simulatorSourcePayload(
        graph,
        version.sourceLanguage,
      );
      const sourceHash = hashContent(sourcePayload);
      const [latestSource] = await tx
        .select({
          id: translationSourceVersions.id,
          version: translationSourceVersions.version,
          hash: translationSourceVersions.sourceContentHash,
        })
        .from(translationSourceVersions)
        .where(
          and(
            eq(translationSourceVersions.entityKind, "simulator_flow"),
            eq(translationSourceVersions.entityId, input.flowId),
          ),
        )
        .orderBy(desc(translationSourceVersions.version))
        .limit(1);
      if (latestSource?.hash !== sourceHash) {
        await tx.insert(translationSourceVersions).values({
          organizationId: version.organizationId,
          entityKind: "simulator_flow",
          entityId: input.flowId,
          version: latestSource ? latestSource.version + 1 : 1,
          previousVersionId: latestSource?.id ?? null,
          sourceLanguageCode: version.sourceLanguage,
          sourceContentJson: sourcePayload,
          sourceContentHash: sourceHash,
          impact: latestSource ? "review_required" : "initial",
          createdById: actorId,
        });
      }

      await tx
        .update(flows)
        .set({ internalName: graph.internalName, updatedAt: new Date() })
        .where(eq(flows.id, input.flowId));
      await tx.delete(nodes).where(eq(nodes.versionId, input.versionId));

      const dbNodeByClientId = new Map<string, { id: string; key: string }>();
      for (const node of graph.nodes) {
        const [inserted] = await tx
          .insert(nodes)
          .values({
            versionId: input.versionId,
            nodeKey: node.key,
            kind: node.kind,
            optional: node.optional,
            positionX: node.position.x,
            positionY: node.position.y,
          })
          .returning({ id: nodes.id, key: nodes.nodeKey });
        if (!inserted) throw new Error("Node insert returned no row");
        dbNodeByClientId.set(node.id, inserted);

        const translationValues = (["fr", "en", "ar"] as const).flatMap(
          (languageCode) => {
            const translation = node.translations[languageCode];
            if (
              !translation.prompt.trim() &&
              !translation.explanation.trim() &&
              !translation.resultBody.trim() &&
              !translation.disclaimer.trim()
            ) {
              return [];
            }
            return [
              {
                nodeId: inserted.id,
                languageCode,
                prompt: translation.prompt.trim() || null,
                explanation: translation.explanation.trim() || null,
                resultBody: translation.resultBody.trim() || null,
                disclaimer: translation.disclaimer.trim() || null,
                state: "draft" as const,
              },
            ];
          },
        );
        if (translationValues.length > 0) {
          await tx.insert(nodeTranslations).values(translationValues);
        }
      }

      const optionIdByClientId = new Map<string, string>();
      for (const node of graph.nodes) {
        const dbNode = dbNodeByClientId.get(node.id);
        if (!dbNode) throw new Error("Missing inserted node");
        for (const [sortOrder, option] of node.options.entries()) {
          const [inserted] = await tx
            .insert(options)
            .values({
              nodeId: dbNode.id,
              optionKey: option.key,
              sortOrder,
              preferNotToSay: option.preferNotToSay,
            })
            .returning({ id: options.id });
          if (!inserted) throw new Error("Option insert returned no row");
          optionIdByClientId.set(option.id, inserted.id);
          const labelValues = (["fr", "en", "ar"] as const).flatMap(
            (languageCode) => {
              const label = option.labels[languageCode].trim();
              return label
                ? [
                    {
                      optionId: inserted.id,
                      languageCode,
                      label,
                      state: "draft" as const,
                    },
                  ]
                : [];
            },
          );
          if (labelValues.length > 0) {
            await tx.insert(optionTranslations).values(labelValues);
          }
        }
      }

      for (const edge of graph.edges) {
        const fromNode = dbNodeByClientId.get(edge.source);
        const toNode = dbNodeByClientId.get(edge.target);
        if (!fromNode || !toNode) throw new Error("Missing edge node");
        const optionClientId = edge.sourceHandle?.startsWith("option:")
          ? edge.sourceHandle.slice("option:".length)
          : null;
        const optionId = optionClientId
          ? optionIdByClientId.get(optionClientId)
          : null;
        if (optionClientId && !optionId) {
          throw new Error("A connection points to a missing choice");
        }
        await tx.insert(edges).values({
          versionId: input.versionId,
          fromNodeId: fromNode.id,
          optionId,
          toNodeId: toNode.id,
        });
      }

      const entryNode = dbNodeByClientId.get(graph.entryNodeId);
      if (!entryNode) throw new Error("Missing start node");
      await tx
        .update(flowVersions)
        .set({
          entryNodeKey: entryNode.key,
          sourceSummary: graph.sourceSummary || null,
          lastReviewedAt: graph.lastReviewedAt
            ? new Date(graph.lastReviewedAt)
            : null,
          reviewDueAt: graph.reviewDueAt ? new Date(graph.reviewDueAt) : null,
        })
        .where(eq(flowVersions.id, input.versionId));
    });

    await recordAudit({
      action: "simulator.draft_saved",
      subjectType: "simulator_flow",
      subjectId: input.flowId,
      metadata: {
        versionId: input.versionId,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      },
    });
    refresh(locale, input.flowId);
    return { savedAt: new Date().toISOString() };
  },
);

const publicationSchema = z.object({
  flowId: z.string().uuid(),
  versionId: z.string().uuid(),
  reviewConfirmed: z.literal("confirmed"),
});

const demoContentPattern =
  /\b(demo data|do not publish|fictional test|test flow)\b|^demo\s*[—-]/i;

export const publishSimulatorVersion = protectedPermissionAction(
  "content.simulator.review",
  async (formData, locale) => {
    const parsed = publicationSchema.parse({
      flowId: formData.get("flowId"),
      versionId: formData.get("versionId"),
      reviewConfirmed: formData.get("reviewConfirmed"),
    });
    const session = await auth();
    const publisherId = session?.user.id;
    if (!publisherId) throw new Error("A signed-in publisher is required");

    const published = await db.transaction(async (tx) => {
      const [version] = await tx
        .select({
          id: flowVersions.id,
          flowId: flowVersions.flowId,
          status: flowVersions.status,
          sourceLanguage: flowVersions.sourceLanguageCode,
          entryNodeKey: flowVersions.entryNodeKey,
          sourceSummary: flowVersions.sourceSummary,
          lastReviewedAt: flowVersions.lastReviewedAt,
          reviewDueAt: flowVersions.reviewDueAt,
          slug: flows.slug,
          internalName: flows.internalName,
          archivedAt: flows.archivedAt,
        })
        .from(flowVersions)
        .innerJoin(flows, eq(flows.id, flowVersions.flowId))
        .where(
          and(
            eq(flowVersions.id, parsed.versionId),
            eq(flowVersions.flowId, parsed.flowId),
          ),
        )
        .limit(1);
      if (version?.status !== "draft" || version.archivedAt) {
        throw new Error("Only an active draft simulator can be published");
      }
      if (
        version.sourceLanguage !== "fr" &&
        version.sourceLanguage !== "en" &&
        version.sourceLanguage !== "ar"
      ) {
        throw new Error("The simulator source language is unsupported");
      }
      if (!version.lastReviewedAt || !version.reviewDueAt) {
        throw new Error("Review dates are required before publication");
      }
      if (
        demoContentPattern.test(version.internalName) ||
        demoContentPattern.test(version.sourceSummary ?? "")
      ) {
        throw new Error(
          "Demo or fictional content cannot be published. Use the private visitor preview instead.",
        );
      }

      const nodeRows = await tx
        .select({
          id: nodes.id,
          key: nodes.nodeKey,
          kind: nodes.kind,
        })
        .from(nodes)
        .where(eq(nodes.versionId, version.id));
      if (nodeRows.length === 0 || !version.entryNodeKey) {
        throw new Error("The simulator needs a valid starting step");
      }
      const nodeIds = nodeRows.map((node) => node.id);
      const [translationRows, optionRows, edgeRows] = await Promise.all([
        tx
          .select({
            nodeId: nodeTranslations.nodeId,
            prompt: nodeTranslations.prompt,
            resultBody: nodeTranslations.resultBody,
            disclaimer: nodeTranslations.disclaimer,
          })
          .from(nodeTranslations)
          .where(
            and(
              inArray(nodeTranslations.nodeId, nodeIds),
              eq(nodeTranslations.languageCode, version.sourceLanguage),
            ),
          ),
        tx
          .select({ id: options.id, nodeId: options.nodeId })
          .from(options)
          .where(inArray(options.nodeId, nodeIds)),
        tx
          .select({
            fromNodeId: edges.fromNodeId,
            optionId: edges.optionId,
            toNodeId: edges.toNodeId,
          })
          .from(edges)
          .where(eq(edges.versionId, version.id)),
      ]);
      const translationByNode = new Map(
        translationRows.map((translation) => [translation.nodeId, translation]),
      );
      const outgoingByNode = new Map<string, typeof edgeRows>();
      for (const edge of edgeRows) {
        const outgoing = outgoingByNode.get(edge.fromNodeId) ?? [];
        outgoing.push(edge);
        outgoingByNode.set(edge.fromNodeId, outgoing);
      }
      for (const node of nodeRows) {
        const translation = translationByNode.get(node.id);
        if (!translation?.prompt?.trim()) {
          throw new Error("Every step needs source-language text");
        }
        const outgoing = outgoingByNode.get(node.id) ?? [];
        if (node.kind === "question") {
          const nodeOptions = optionRows.filter(
            (option) => option.nodeId === node.id,
          );
          if (
            nodeOptions.length === 0 ||
            nodeOptions.some(
              (option) => !outgoing.some((edge) => edge.optionId === option.id),
            )
          ) {
            throw new Error(
              "Every question choice needs a valid next step before publication",
            );
          }
        } else if (node.kind === "information" && outgoing.length !== 1) {
          throw new Error("Every information step needs exactly one next step");
        } else if (node.kind === "result") {
          if (outgoing.length > 0) {
            throw new Error("A result step cannot have an onward connection");
          }
          if (
            !translation.resultBody?.trim() ||
            !translation.disclaimer?.trim()
          ) {
            throw new Error(
              "Every result needs reviewed guidance and a disclaimer",
            );
          }
        }
      }

      const entryNode = nodeRows.find(
        (node) => node.key === version.entryNodeKey,
      );
      if (!entryNode) throw new Error("The starting step no longer exists");
      const reachable = new Set<string>();
      const pending = [entryNode.id];
      while (pending.length > 0) {
        const nodeId = pending.pop();
        if (!nodeId || reachable.has(nodeId)) continue;
        reachable.add(nodeId);
        for (const edge of outgoingByNode.get(nodeId) ?? []) {
          pending.push(edge.toNodeId);
        }
      }
      const reachableResults = nodeRows.filter(
        (node) => reachable.has(node.id) && node.kind === "result",
      );
      if (reachableResults.length === 0) {
        throw new Error("The published path must reach at least one result");
      }

      const now = new Date();
      await tx
        .update(versionPublications)
        .set({ unpublishedAt: now })
        .where(
          and(
            eq(versionPublications.flowId, version.flowId),
            isNull(versionPublications.unpublishedAt),
          ),
        );
      await tx
        .update(flowVersions)
        .set({ status: "retired" })
        .where(
          and(
            eq(flowVersions.flowId, version.flowId),
            eq(flowVersions.status, "published"),
          ),
        );
      await tx.insert(versionPublications).values({
        flowId: version.flowId,
        versionId: version.id,
        publishedById: publisherId,
        publishedAt: now,
      });
      await tx
        .update(flowVersions)
        .set({ status: "published", publishedAt: now })
        .where(eq(flowVersions.id, version.id));
      return { slug: version.slug };
    });

    await recordAudit({
      action: "simulator.version_published",
      subjectType: "simulator_flow",
      subjectId: parsed.flowId,
      metadata: {
        versionId: parsed.versionId,
        reviewConfirmed: true,
      },
    });
    refresh(locale, parsed.flowId);
    refreshPublicSimulator(published.slug);
  },
);

const unpublishSchema = z.object({
  flowId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const unpublishSimulatorVersion = protectedPermissionAction(
  "content.simulator.review",
  async (formData, locale) => {
    const parsed = unpublishSchema.parse({
      flowId: formData.get("flowId"),
      versionId: formData.get("versionId"),
    });
    const session = await auth();
    if (!session?.user.id) throw new Error("A signed-in publisher is required");
    const [flow] = await db
      .select({ slug: flows.slug })
      .from(flows)
      .where(eq(flows.id, parsed.flowId))
      .limit(1);
    if (!flow) throw new Error("Simulator path not found");

    await db.transaction(async (tx) => {
      await tx
        .update(versionPublications)
        .set({ unpublishedAt: new Date() })
        .where(
          and(
            eq(versionPublications.flowId, parsed.flowId),
            eq(versionPublications.versionId, parsed.versionId),
            isNull(versionPublications.unpublishedAt),
          ),
        );
      await tx
        .update(flowVersions)
        .set({ status: "retired" })
        .where(
          and(
            eq(flowVersions.id, parsed.versionId),
            eq(flowVersions.flowId, parsed.flowId),
            eq(flowVersions.status, "published"),
          ),
        );
    });

    await recordAudit({
      action: "simulator.version_unpublished",
      subjectType: "simulator_flow",
      subjectId: parsed.flowId,
      metadata: { versionId: parsed.versionId },
    });
    refresh(locale, parsed.flowId);
    refreshPublicSimulator(flow.slug);
  },
);

export const archiveSimulatorFlow = protectedPermissionAction(
  "content.simulator.review",
  async (formData, locale) => {
    const flowId = z.string().uuid().parse(formData.get("flowId"));
    const [flow] = await db
      .select({ slug: flows.slug })
      .from(flows)
      .where(eq(flows.id, flowId))
      .limit(1);
    if (!flow) throw new Error("Simulator path not found");
    await db.transaction(async (tx) => {
      const now = new Date();
      await tx
        .update(versionPublications)
        .set({ unpublishedAt: now })
        .where(
          and(
            eq(versionPublications.flowId, flowId),
            isNull(versionPublications.unpublishedAt),
          ),
        );
      await tx
        .update(flowVersions)
        .set({ status: "retired" })
        .where(
          and(
            eq(flowVersions.flowId, flowId),
            eq(flowVersions.status, "published"),
          ),
        );
      await tx
        .update(flows)
        .set({ archivedAt: now, updatedAt: now })
        .where(eq(flows.id, flowId));
    });
    await recordAudit({
      action: "simulator.flow_archived",
      subjectType: "simulator_flow",
      subjectId: flowId,
    });
    refresh(locale, flowId);
    refreshPublicSimulator(flow.slug);
  },
);

export const restoreSimulatorFlow = protectedPermissionAction(
  "content.simulator.review",
  async (formData, locale) => {
    const flowId = z.string().uuid().parse(formData.get("flowId"));
    await db
      .update(flows)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(flows.id, flowId));
    await recordAudit({
      action: "simulator.flow_restored",
      subjectType: "simulator_flow",
      subjectId: flowId,
    });
    refresh(locale, flowId);
  },
);
