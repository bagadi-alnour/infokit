import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  archiveSimulatorFlow,
  restoreSimulatorFlow,
} from "~/app/[locale]/dashboard/simulator/actions";
import { updateSimulatorFlowSteward } from "~/app/[locale]/dashboard/steward-actions";
import {
  SimulatorFlowEditor,
  type SimulatorChoice,
  type SimulatorFlowNode,
  type SimulatorLanguage,
  type SimulatorNodeData,
  type SimulatorTranslation,
} from "~/components/admin/simulator-flow-editor";
import { SimulatorTranslationPanel } from "~/components/admin/simulator-translation-panel";
import { StewardContactForm } from "~/components/admin/steward-contact-form";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { requirePermission } from "~/server/auth/require";
import { loadStewardCandidates } from "~/server/content/steward-candidates";
import { db } from "~/server/db";
import {
  edges,
  flows,
  flowVersions,
  nodes,
  nodeTranslations,
  options,
  optionTranslations,
  translationAssignments,
} from "~/server/db/schema";

const languages = ["fr", "en", "ar"] as const;

const emptyTranslation = (): SimulatorTranslation => ({
  prompt: "",
  explanation: "",
  resultBody: "",
  disclaimer: "",
});

function dateInputValue(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function SimulatorEditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: localeParam, id } = await params;
  const locale = requireRouteLocale(localeParam);
  await requirePermission("content.simulator.review", locale);
  const [t, shared] = await Promise.all([
    loadPageCatalog(locale, "dashboard-simulator"),
    // The steward contact reads from the shared console catalogue, so the
    // wording is the same on every content type.
    loadPageCatalog(locale, "dashboard-console"),
  ]);

  const [flow] = await db
    .select({
      id: flows.id,
      slug: flows.slug,
      internalName: flows.internalName,
      archivedAt: flows.archivedAt,
      // Workspace-only: who to ask about this flow. Never read publicly.
      stewardName: flows.stewardName,
      stewardPhone: flows.stewardPhone,
      stewardEmail: flows.stewardEmail,
      createdById: flows.createdById,
    })
    .from(flows)
    .where(eq(flows.id, id))
    .limit(1);
  if (!flow) notFound();

  /**
   * A flow is the platform's own, so there is no roster to offer: whoever built
   * it is the person to ask, and naming them is one click rather than typing an
   * address the platform already holds.
   */
  const stewardCandidates = await loadStewardCandidates({
    authorId: flow.createdById,
  });

  const versionRows = await db
    .select({
      id: flowVersions.id,
      versionNumber: flowVersions.versionNumber,
      status: flowVersions.status,
      sourceLanguage: flowVersions.sourceLanguageCode,
      entryNodeKey: flowVersions.entryNodeKey,
      sourceSummary: flowVersions.sourceSummary,
      lastReviewedAt: flowVersions.lastReviewedAt,
      reviewDueAt: flowVersions.reviewDueAt,
    })
    .from(flowVersions)
    .where(eq(flowVersions.flowId, flow.id))
    .orderBy(desc(flowVersions.versionNumber));
  const version =
    versionRows.find((candidate) => candidate.status === "draft") ??
    versionRows[0];
  if (!version) notFound();
  if (!languages.includes(version.sourceLanguage as SimulatorLanguage)) {
    notFound();
  }
  const sourceLanguage = version.sourceLanguage as SimulatorLanguage;
  const demoContent =
    /\b(demo data|do not publish|fictional test|test flow)\b|^demo\s*[—-]/i.test(
      `${flow.internalName}\n${version.sourceSummary ?? ""}`,
    );

  const nodeRows = await db
    .select({
      id: nodes.id,
      key: nodes.nodeKey,
      kind: nodes.kind,
      optional: nodes.optional,
      positionX: nodes.positionX,
      positionY: nodes.positionY,
    })
    .from(nodes)
    .where(eq(nodes.versionId, version.id))
    .orderBy(asc(nodes.nodeKey));
  const nodeIds = nodeRows.map((node) => node.id);

  const [translationRows, optionRows, edgeRows] =
    nodeIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          db
            .select({
              nodeId: nodeTranslations.nodeId,
              languageCode: nodeTranslations.languageCode,
              prompt: nodeTranslations.prompt,
              explanation: nodeTranslations.explanation,
              resultBody: nodeTranslations.resultBody,
              disclaimer: nodeTranslations.disclaimer,
              state: nodeTranslations.state,
            })
            .from(nodeTranslations)
            .where(inArray(nodeTranslations.nodeId, nodeIds)),
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
              id: edges.id,
              source: edges.fromNodeId,
              target: edges.toNodeId,
              optionId: edges.optionId,
            })
            .from(edges)
            .where(eq(edges.versionId, version.id)),
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
          .where(inArray(optionTranslations.optionId, optionIds));
  const assignmentRows = await db
    .select({
      id: translationAssignments.id,
      languageCode: translationAssignments.targetLanguageCode,
      state: translationAssignments.state,
      translatorEmail: translationAssignments.translatorEmail,
      translatorName: translationAssignments.translatorName,
      requestedAt: translationAssignments.createdAt,
      expiresAt: translationAssignments.expiresAt,
    })
    .from(translationAssignments)
    .where(
      and(
        eq(translationAssignments.entityKind, "simulator_flow"),
        eq(translationAssignments.entityId, flow.id),
        isNull(translationAssignments.revokedAt),
        isNull(translationAssignments.expiredAt),
      ),
    )
    .orderBy(desc(translationAssignments.createdAt));

  const translationsByNode = new Map<
    string,
    Record<SimulatorLanguage, SimulatorTranslation>
  >();
  for (const node of nodeRows) {
    translationsByNode.set(node.id, {
      fr: emptyTranslation(),
      en: emptyTranslation(),
      ar: emptyTranslation(),
    });
  }
  for (const translation of translationRows) {
    if (!languages.includes(translation.languageCode as SimulatorLanguage)) {
      continue;
    }
    const localized = translationsByNode.get(translation.nodeId);
    if (!localized) continue;
    localized[translation.languageCode as SimulatorLanguage] = {
      prompt: translation.prompt ?? "",
      explanation: translation.explanation ?? "",
      resultBody: translation.resultBody ?? "",
      disclaimer: translation.disclaimer ?? "",
    };
  }

  const labelsByOption = new Map<string, Record<SimulatorLanguage, string>>();
  for (const option of optionRows) {
    labelsByOption.set(option.id, { fr: "", en: "", ar: "" });
  }
  for (const translation of optionTranslationRows) {
    if (!languages.includes(translation.languageCode as SimulatorLanguage)) {
      continue;
    }
    const localized = labelsByOption.get(translation.optionId);
    if (localized) {
      localized[translation.languageCode as SimulatorLanguage] =
        translation.label;
    }
  }

  const optionsByNode = new Map<string, SimulatorChoice[]>();
  for (const option of optionRows) {
    const list = optionsByNode.get(option.nodeId) ?? [];
    list.push({
      id: option.id,
      key: option.key,
      preferNotToSay: option.preferNotToSay,
      labels: labelsByOption.get(option.id) ?? { fr: "", en: "", ar: "" },
    });
    optionsByNode.set(option.nodeId, list);
  }

  const initialNodes: SimulatorFlowNode[] = nodeRows.map((node) => {
    const data: SimulatorNodeData = {
      key: node.key,
      kind: node.kind,
      optional: node.optional,
      translations: translationsByNode.get(node.id) ?? {
        fr: emptyTranslation(),
        en: emptyTranslation(),
        ar: emptyTranslation(),
      },
      options: optionsByNode.get(node.id) ?? [],
      entry: node.key === version.entryNodeKey,
      interfaceLanguage: locale,
      messages: t,
    };
    return {
      id: node.id,
      type:
        node.kind === "question"
          ? "simulator-question"
          : node.kind === "information"
            ? "simulator-information"
            : "simulator-result",
      position: { x: node.positionX, y: node.positionY },
      data,
    };
  });

  const initialEdges = edgeRows.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.optionId ? `option:${edge.optionId}` : "next",
    type: "smoothstep",
  }));
  const assignmentByLanguage = new Map<
    string,
    (typeof assignmentRows)[number]
  >();
  for (const assignment of assignmentRows) {
    if (!assignmentByLanguage.has(assignment.languageCode)) {
      assignmentByLanguage.set(assignment.languageCode, assignment);
    }
  }
  const authoredLanguages = new Set(
    translationRows
      .filter((translation) => Boolean(translation.prompt?.trim()))
      .map((translation) => translation.languageCode),
  );
  const languageStatuses = languages.map((code) => {
    const assignment = assignmentByLanguage.get(code);
    return {
      code,
      authored: authoredLanguages.has(code),
      state:
        translationRows.find(
          (translation) =>
            translation.languageCode === code && translation.prompt?.trim(),
        )?.state ?? "draft",
      assignment: assignment
        ? {
            id: assignment.id,
            state:
              assignment.expiresAt <= new Date() &&
              !["accepted", "rejected", "published"].includes(assignment.state)
                ? "expired"
                : assignment.state,
            translatorEmail: assignment.translatorEmail,
            translatorName: assignment.translatorName,
            requestedAt: new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(assignment.requestedAt),
            expiresAt: new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(assignment.expiresAt),
          }
        : null,
    };
  });

  return (
    <div className="min-h-0">
      <div className="border-line bg-surface flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={localizedPath("/dashboard/simulator", locale)} />}
        >
          <ArrowLeft aria-hidden />
          {t["editor.back"]}
        </Button>
        <form
          action={flow.archivedAt ? restoreSimulatorFlow : archiveSimulatorFlow}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="flowId" value={flow.id} />
          <PendingButton
            variant="ghost"
            className={flow.archivedAt ? "h-8" : "text-danger h-8"}
          >
            {flow.archivedAt ? t.restore : t.archive}
          </PendingButton>
        </form>
      </div>
      <SimulatorFlowEditor
        locale={locale}
        flowId={flow.id}
        versionId={version.id}
        versionNumber={version.versionNumber}
        status={flow.archivedAt ? "archived" : version.status}
        sourceLanguage={sourceLanguage}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        initialMetadata={{
          internalName: flow.internalName,
          sourceSummary: version.sourceSummary ?? "",
          lastReviewedDate: dateInputValue(version.lastReviewedAt),
          reviewDueDate: dateInputValue(version.reviewDueAt),
        }}
        previewUrl={localizedPath(`/simulator/preview/${flow.id}`, locale)}
        publicUrl={localizedPath(`/simulator/${flow.slug}`, locale)}
        demoContent={demoContent}
        translationPanel={
          <SimulatorTranslationPanel
            locale={locale}
            flowId={flow.id}
            sourceLanguage={sourceLanguage}
            languages={languageStatuses}
            labels={t}
            disabled={flow.archivedAt !== null}
          />
        }
        stewardPanel={
          <>
            <h2 className="font-semibold">{shared["steward.title"]}</h2>
            <p className="text-copy-muted mt-1 text-xs leading-relaxed">
              {shared["steward.hint"]}
            </p>
            <div className="mt-4">
              <StewardContactForm
                action={updateSimulatorFlowSteward}
                locale={locale}
                recordId={flow.id}
                values={flow}
                members={stewardCandidates}
                labels={shared}
                columns={false}
              />
            </div>
          </>
        }
        messages={t}
      />
    </div>
  );
}
