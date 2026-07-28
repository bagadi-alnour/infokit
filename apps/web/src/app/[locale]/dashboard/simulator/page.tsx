import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";

import {
  SIMULATOR_STATES,
  type SimulatorStateValue,
} from "~/components/admin/content-states";
import {
  SimulatorTable,
  type SimulatorTableLabels,
  type SimulatorTableRow,
} from "~/components/admin/simulator-table";
import {
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { auth } from "~/server/auth";
import { hasActualPlatformPermission } from "~/server/auth/authorization";
import { requirePermission } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  cities,
  cityTranslations,
  flows,
  flowVersions,
  nodes,
  nodeTranslations,
  organizations,
  users,
  versionPublications,
} from "~/server/db/schema";

export default async function SimulatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  await requirePermission("content.simulator.review", locale);
  const t = await loadPageCatalog(locale, "dashboard-simulator");
  const session = await auth();
  const viewerId = session?.user.id ?? null;
  // A platform administrator answers for a path whose author has left, and for
  // the seeded paths nobody built.
  const canManageGlobal = Boolean(
    viewerId &&
    (await hasActualPlatformPermission(viewerId, "support.superadmin")),
  );

  const [flowRows, versionRows, nodeRows, translationRows, publicationRows] =
    await Promise.all([
      db
        .select({
          id: flows.id,
          slug: flows.slug,
          internalName: flows.internalName,
          updatedAt: flows.updatedAt,
          archivedAt: flows.archivedAt,
          ownerName: organizations.displayName,
          cityCode: cities.code,
          cityName: cityTranslations.name,
          // Who built it. The organisation answers for the facts; this is the
          // person to ask what a branch meant.
          createdByName: users.name,
          // Who may operate on it from the list. Compared on the server; the
          // browser is told the answer, not the identity it came from.
          createdById: flows.createdById,
        })
        .from(flows)
        .leftJoin(
          organizations,
          eq(organizations.id, flows.ownerOrganizationId),
        )
        .leftJoin(cities, eq(cities.id, flows.cityId))
        .leftJoin(
          cityTranslations,
          and(
            eq(cityTranslations.cityId, cities.id),
            eq(cityTranslations.languageCode, locale),
          ),
        )
        .leftJoin(users, eq(users.id, flows.createdById))
        .orderBy(desc(flows.updatedAt)),
      db
        .select({
          id: flowVersions.id,
          flowId: flowVersions.flowId,
          versionNumber: flowVersions.versionNumber,
          sourceLanguage: flowVersions.sourceLanguageCode,
          status: flowVersions.status,
          lastReviewedAt: flowVersions.lastReviewedAt,
          reviewDueAt: flowVersions.reviewDueAt,
        })
        .from(flowVersions)
        .orderBy(desc(flowVersions.versionNumber)),
      db.select({ id: nodes.id, versionId: nodes.versionId }).from(nodes),
      db
        .select({
          nodeId: nodeTranslations.nodeId,
          languageCode: nodeTranslations.languageCode,
          prompt: nodeTranslations.prompt,
        })
        .from(nodeTranslations),
      // What a visitor can reach right now, and the version to take down again:
      // the version's own status says what it was, publication says what it is.
      db
        .select({
          flowId: versionPublications.flowId,
          versionId: versionPublications.versionId,
        })
        .from(versionPublications)
        .where(isNull(versionPublications.unpublishedAt)),
    ]);

  const latestByFlow = new Map<string, (typeof versionRows)[number]>();
  for (const version of versionRows) {
    if (!latestByFlow.has(version.flowId))
      latestByFlow.set(version.flowId, version);
  }
  const publishedVersionByFlow = new Map(
    publicationRows.map((row) => [row.flowId, row.versionId]),
  );
  const nodeCountByVersion = new Map<string, number>();
  const versionByNode = new Map<string, string>();
  for (const node of nodeRows) {
    versionByNode.set(node.id, node.versionId);
    nodeCountByVersion.set(
      node.versionId,
      (nodeCountByVersion.get(node.versionId) ?? 0) + 1,
    );
  }
  const languagesByVersion = new Map<string, Set<string>>();
  for (const translation of translationRows) {
    if (!translation.prompt?.trim()) continue;
    const versionId = versionByNode.get(translation.nodeId);
    if (!versionId) continue;
    const languages = languagesByVersion.get(versionId) ?? new Set<string>();
    languages.add(translation.languageCode);
    languagesByVersion.set(versionId, languages);
  }

  const now = new Date();
  const rows = flowRows.flatMap((flow) => {
    const version = latestByFlow.get(flow.id);
    if (!version) return [];
    const publishedVersionId = publishedVersionByFlow.get(flow.id) ?? null;
    /**
     * A path that is out of the workspace says so first. Otherwise publication
     * answers — a live version is published whatever a newer draft is doing —
     * and only then the latest version's own status.
     */
    const state: SimulatorStateValue = flow.archivedAt
      ? "archived"
      : publishedVersionId
        ? "published"
        : version.status;
    return [
      {
        ...flow,
        version,
        publishedVersionId,
        state,
        nodeCount: nodeCountByVersion.get(version.id) ?? 0,
        languages: [...(languagesByVersion.get(version.id) ?? [])],
        reviewDue: version.reviewDueAt !== null && version.reviewDueAt <= now,
      },
    ];
  });

  const draftCount = rows.filter((row) => row.state === "draft").length;
  const reviewCount = rows.filter((row) => row.reviewDue).length;
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  });
  const languageName = (code: string) =>
    code === "fr" || code === "en" || code === "ar"
      ? t[`language.${code}`]
      : code;

  /**
   * Who may change a path from the list: whoever built it, and a platform
   * administrator. Everyone else with the review permission reads it.
   */
  const mayEdit = (createdById: string | null) =>
    canManageGlobal || (viewerId !== null && createdById === viewerId);

  const tableRows: SimulatorTableRow[] = rows.map((flow) => {
    const canEdit = mayEdit(flow.createdById);
    return {
      id: flow.id,
      href: localizedPath(`/dashboard/simulator/${flow.id}`, locale),
      title: flow.internalName,
      sub: `/${flow.slug} · ${t.version.replace(
        "{number}",
        String(flow.version.versionNumber),
      )} · ${t.nodes.replace("{count}", String(flow.nodeCount))}`,
      // A path with no organisation is one the platform holds itself, so the
      // owner column names the platform rather than leaving the cell empty.
      owner: flow.ownerName ?? t.platformOwner,
      scopeLabel: flow.cityName ?? flow.cityCode ?? t.allCities,
      createdBy: flow.createdByName,
      state: flow.state,
      languages: flow.languages.map(languageName),
      updatedAtIso: flow.updatedAt.toISOString(),
      updatedLabel: dateFormatter.format(flow.updatedAt),
      reviewDue: flow.reviewDue,
      visitorHref: localizedPath(
        flow.publishedVersionId
          ? `/simulator/${flow.slug}`
          : `/simulator/preview/${flow.id}`,
        locale,
      ),
      publishedVersionId: flow.publishedVersionId,
      canEdit,
      // Publishing is a promise to a visitor: a path keeps it until someone
      // takes it down, and only then can it leave the list.
      canArchive: canEdit && !flow.publishedVersionId && !flow.archivedAt,
      canRestore: canEdit && flow.archivedAt !== null,
    };
  });

  const tableLabels: SimulatorTableLabels = {
    search: t["table.search"],
    searchPlaceholder: t["list.searchPlaceholder"],
    columns: t["table.columns"],
    clear: t["table.clear"],
    filterBy: t["table.filterBy"],
    noMatch: t["list.noResults"],
    rowsPerPage: t["table.rowsPerPage"],
    results: t["table.results"],
    page: t["table.page"],
    previous: t["table.previous"],
    next: t["table.next"],
    path: t["list.pathColumn"],
    owner: t["list.ownerColumn"],
    city: t["list.cityColumn"],
    createdBy: t["list.createdByColumn"],
    status: t["list.statusColumn"],
    languages: t["list.languagesColumn"],
    updated: t["list.updatedColumn"],
    reviewDue: t["list.reviewDueChip"],
    // Punctuation, not wording: an empty cell reads as a missing value.
    none: "—",
    stateLabels: Object.fromEntries(
      SIMULATOR_STATES.map((state) => [state, t[`status.${state}`]]),
    ) as Record<SimulatorStateValue, string>,
    actions: t["list.actions"],
    open: t["rowAction.open"],
    view: t["rowAction.view"],
    viewVisitor: t["list.view"],
    unpublish: t["publication.unpublish"],
    unpublishTitle: t["publication.unpublishTitle"],
    unpublishBody: t["publication.unpublishDescription"],
    unpublishConfirm: t["publication.unpublish"],
    unpublished: t["publication.unpublished"],
    remove: t["list.delete"],
    removeTitle: t["list.deleteTitle"],
    removeBody: t["list.deleteDescription"],
    removeConfirm: t["list.deleteConfirm"],
    removed: t["list.deleteSuccess"],
    restore: t.restore,
    restored: t["list.restoreSuccess"],
    cancel: t.cancel,
    actionError: t["list.deleteError"],
  };

  // Adding a path belongs to the list's own toolbar, beside the controls that
  // shape the list. The header keeps it only while there is no list yet — the
  // first path has to be creatable from an empty page.
  const createPath = (
    <Button
      nativeButton={false}
      render={<Link href={localizedPath("/dashboard/simulator/new", locale)} />}
    >
      <Plus aria-hidden />
      {t.newFlow}
    </Button>
  );

  return (
    <WorkspacePage>
      <PageHeader
        title={t.title}
        sub={t.sub}
        action={rows.length === 0 ? createPath : null}
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-copy-muted py-14 text-center text-sm">
            {t.emptyHint}
          </CardContent>
        </Card>
      ) : (
        <>
          <StatGrid>
            <Stat label={t["list.total"]} value={rows.length} />
            <Stat label={t["list.drafts"]} value={draftCount} />
            <Stat label={t["list.reviewDue"]} value={reviewCount} />
          </StatGrid>

          <SimulatorTable
            rows={tableRows}
            locale={locale}
            labels={tableLabels}
            createAction={createPath}
          />
        </>
      )}
    </WorkspacePage>
  );
}
