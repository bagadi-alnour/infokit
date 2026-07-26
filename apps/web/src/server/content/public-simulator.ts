import type { PublicLocale } from "@infokit/shared/i18n";
import type { PublicSimulatorDocument } from "@infokit/shared/public-simulator";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "~/server/db";
import {
  edges,
  cities,
  cityTranslations,
  flows,
  flowVersions,
  nodes,
  nodeTranslations,
  options,
  optionTranslations,
  versionPublications,
} from "~/server/db/schema";

type SimulatorVersionRow = {
  flowId: string;
  slug: string;
  title: string;
  versionId: string;
  versionNumber: number;
  sourceLanguage: string;
  entryNodeKey: string | null;
  summary: string | null;
  lastReviewedAt: Date | null;
  reviewDueAt: Date | null;
  publishedAt: Date | null;
};

async function assembleSimulator(
  version: SimulatorVersionRow,
  locale: PublicLocale,
): Promise<PublicSimulatorDocument | null> {
  if (
    version.sourceLanguage !== "fr" &&
    version.sourceLanguage !== "en" &&
    version.sourceLanguage !== "ar"
  ) {
    return null;
  }

  const nodeRows = await db
    .select({
      id: nodes.id,
      key: nodes.nodeKey,
      kind: nodes.kind,
      optional: nodes.optional,
    })
    .from(nodes)
    .where(eq(nodes.versionId, version.versionId))
    .orderBy(asc(nodes.nodeKey));
  if (nodeRows.length === 0 || !version.entryNodeKey) return null;

  const nodeIds = nodeRows.map((node) => node.id);
  const translationLanguages =
    locale === version.sourceLanguage
      ? [locale]
      : [locale, version.sourceLanguage];
  const [translationRows, optionRows, edgeRows] = await Promise.all([
    db
      .select({
        nodeId: nodeTranslations.nodeId,
        languageCode: nodeTranslations.languageCode,
        prompt: nodeTranslations.prompt,
        explanation: nodeTranslations.explanation,
        resultBody: nodeTranslations.resultBody,
        disclaimer: nodeTranslations.disclaimer,
      })
      .from(nodeTranslations)
      .where(
        and(
          inArray(nodeTranslations.nodeId, nodeIds),
          inArray(nodeTranslations.languageCode, translationLanguages),
        ),
      ),
    db
      .select({
        id: options.id,
        nodeId: options.nodeId,
        key: options.optionKey,
        sortOrder: options.sortOrder,
        preferNotToSay: options.preferNotToSay,
      })
      .from(options)
      .where(inArray(options.nodeId, nodeIds))
      .orderBy(asc(options.sortOrder)),
    db
      .select({
        fromNodeId: edges.fromNodeId,
        optionId: edges.optionId,
        toNodeId: edges.toNodeId,
      })
      .from(edges)
      .where(eq(edges.versionId, version.versionId)),
  ]);

  const optionIds = optionRows.map((option) => option.id);
  const optionTranslationRows =
    optionIds.length === 0
      ? []
      : await db
          .select({
            optionId: optionTranslations.optionId,
            languageCode: optionTranslations.languageCode,
            label: optionTranslations.label,
          })
          .from(optionTranslations)
          .where(
            and(
              inArray(optionTranslations.optionId, optionIds),
              inArray(optionTranslations.languageCode, translationLanguages),
            ),
          );

  let fallbackUsed = false;
  const localizedValue = (
    localized: string | null | undefined,
    source: string | null | undefined,
  ) => {
    if (localized?.trim()) return localized.trim();
    if (locale !== version.sourceLanguage && source?.trim()) {
      fallbackUsed = true;
      return source.trim();
    }
    return source?.trim() ?? "";
  };

  const edgeByOption = new Map<string, string>();
  for (const edge of edgeRows) {
    if (edge.optionId) edgeByOption.set(edge.optionId, edge.toNodeId);
  }
  const nextByNode = new Map(
    edgeRows
      .filter((edge) => !edge.optionId)
      .map((edge) => [edge.fromNodeId, edge.toNodeId]),
  );

  const publicNodes = nodeRows.map((node) => {
    const localized = translationRows.find(
      (translation) =>
        translation.nodeId === node.id && translation.languageCode === locale,
    );
    const source = translationRows.find(
      (translation) =>
        translation.nodeId === node.id &&
        translation.languageCode === version.sourceLanguage,
    );
    const nodeOptions = optionRows
      .filter((option) => option.nodeId === node.id)
      .map((option) => {
        const localizedLabel = optionTranslationRows.find(
          (translation) =>
            translation.optionId === option.id &&
            translation.languageCode === locale,
        )?.label;
        const sourceLabel = optionTranslationRows.find(
          (translation) =>
            translation.optionId === option.id &&
            translation.languageCode === version.sourceLanguage,
        )?.label;
        return {
          id: option.id,
          key: option.key,
          label: localizedValue(localizedLabel, sourceLabel),
          preferNotToSay: option.preferNotToSay,
          nextNodeId: edgeByOption.get(option.id) ?? null,
        };
      });

    return {
      id: node.id,
      key: node.key,
      kind: node.kind,
      optional: node.optional,
      prompt: localizedValue(localized?.prompt, source?.prompt),
      explanation: localizedValue(localized?.explanation, source?.explanation),
      resultBody: localizedValue(localized?.resultBody, source?.resultBody),
      disclaimer: localizedValue(localized?.disclaimer, source?.disclaimer),
      options: nodeOptions,
      nextNodeId: nextByNode.get(node.id) ?? null,
    };
  });

  const entryNode = publicNodes.find(
    (node) => node.key === version.entryNodeKey,
  );
  if (!entryNode) return null;

  return {
    flowId: version.flowId,
    versionId: version.versionId,
    slug: version.slug,
    title: version.title,
    summary: version.summary ?? "",
    sourceLanguage: version.sourceLanguage,
    displayLanguage: locale,
    fallbackUsed,
    versionNumber: version.versionNumber,
    lastReviewedAt: version.lastReviewedAt?.toISOString() ?? null,
    reviewDueAt: version.reviewDueAt?.toISOString() ?? null,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    entryNodeId: entryNode.id,
    nodes: publicNodes,
  };
}

export async function loadPublishedSimulator(
  slug: string,
  locale: PublicLocale,
): Promise<PublicSimulatorDocument | null> {
  const [version] = await db
    .select({
      flowId: flows.id,
      slug: flows.slug,
      title: flows.internalName,
      versionId: flowVersions.id,
      versionNumber: flowVersions.versionNumber,
      sourceLanguage: flowVersions.sourceLanguageCode,
      entryNodeKey: flowVersions.entryNodeKey,
      summary: flowVersions.sourceSummary,
      lastReviewedAt: flowVersions.lastReviewedAt,
      reviewDueAt: flowVersions.reviewDueAt,
      publishedAt: versionPublications.publishedAt,
    })
    .from(flows)
    .innerJoin(
      versionPublications,
      and(
        eq(versionPublications.flowId, flows.id),
        isNull(versionPublications.unpublishedAt),
      ),
    )
    .innerJoin(
      flowVersions,
      and(
        eq(flowVersions.id, versionPublications.versionId),
        eq(flowVersions.status, "published"),
      ),
    )
    .where(and(eq(flows.slug, slug), isNull(flows.archivedAt)))
    .limit(1);
  return version ? assembleSimulator(version, locale) : null;
}

export async function loadSimulatorPreview(
  flowId: string,
  locale: PublicLocale,
): Promise<PublicSimulatorDocument | null> {
  const [version] = await db
    .select({
      flowId: flows.id,
      slug: flows.slug,
      title: flows.internalName,
      versionId: flowVersions.id,
      versionNumber: flowVersions.versionNumber,
      sourceLanguage: flowVersions.sourceLanguageCode,
      entryNodeKey: flowVersions.entryNodeKey,
      summary: flowVersions.sourceSummary,
      lastReviewedAt: flowVersions.lastReviewedAt,
      reviewDueAt: flowVersions.reviewDueAt,
      publishedAt: flowVersions.publishedAt,
    })
    .from(flows)
    .innerJoin(flowVersions, eq(flowVersions.flowId, flows.id))
    .where(and(eq(flows.id, flowId), isNull(flows.archivedAt)))
    .orderBy(desc(flowVersions.versionNumber))
    .limit(1);
  return version ? assembleSimulator(version, locale) : null;
}

export async function listPublishedSimulators(locale: PublicLocale): Promise<
  Array<{
    document: PublicSimulatorDocument;
    cityLabel: string;
  }>
> {
  const versions = await db
    .select({
      flowId: flows.id,
      slug: flows.slug,
      title: flows.internalName,
      versionId: flowVersions.id,
      versionNumber: flowVersions.versionNumber,
      sourceLanguage: flowVersions.sourceLanguageCode,
      entryNodeKey: flowVersions.entryNodeKey,
      summary: flowVersions.sourceSummary,
      lastReviewedAt: flowVersions.lastReviewedAt,
      reviewDueAt: flowVersions.reviewDueAt,
      publishedAt: versionPublications.publishedAt,
      cityCode: cities.code,
      cityLanguage: cityTranslations.languageCode,
      cityName: cityTranslations.name,
    })
    .from(flows)
    .innerJoin(
      versionPublications,
      and(
        eq(versionPublications.flowId, flows.id),
        isNull(versionPublications.unpublishedAt),
      ),
    )
    .innerJoin(
      flowVersions,
      and(
        eq(flowVersions.id, versionPublications.versionId),
        eq(flowVersions.status, "published"),
      ),
    )
    .leftJoin(cities, eq(cities.id, flows.cityId))
    .leftJoin(
      cityTranslations,
      and(
        eq(cityTranslations.cityId, cities.id),
        eq(cityTranslations.languageCode, locale),
      ),
    )
    .where(isNull(flows.archivedAt));

  const assembled = await Promise.all(
    versions.map(async (version) => ({
      document: await assembleSimulator(version, locale),
      cityLabel: version.cityName ?? version.cityCode ?? "",
    })),
  );
  return assembled.flatMap((item) =>
    item.document
      ? [{ document: item.document, cityLabel: item.cityLabel }]
      : [],
  );
}
