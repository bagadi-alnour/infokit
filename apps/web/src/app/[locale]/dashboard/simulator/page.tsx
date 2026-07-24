import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { and, desc, eq } from "drizzle-orm";
import { CalendarClock, GitBranch, Plus, Search } from "lucide-react";
import Link from "next/link";

import { SimulatorRowActions } from "~/components/admin/simulator-row-actions";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
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
} from "~/server/db/schema";

const statusVariant = {
  draft: "outline",
  published: "default",
  retired: "secondary",
  archived: "outline",
} as const;

const listStates = ["draft", "published", "retired", "archived"] as const;

export default async function SimulatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  await requirePermission("content.simulator.review", locale);
  const search = await searchParams;
  const t = await loadPageCatalog(locale, "dashboard-simulator");
  const [flowRows, versionRows, nodeRows, translationRows] = await Promise.all([
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
      })
      .from(flows)
      .leftJoin(organizations, eq(organizations.id, flows.ownerOrganizationId))
      .leftJoin(cities, eq(cities.id, flows.cityId))
      .leftJoin(
        cityTranslations,
        and(
          eq(cityTranslations.cityId, cities.id),
          eq(cityTranslations.languageCode, locale),
        ),
      )
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
  ]);

  const latestByFlow = new Map<string, (typeof versionRows)[number]>();
  for (const version of versionRows) {
    if (!latestByFlow.has(version.flowId))
      latestByFlow.set(version.flowId, version);
  }
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

  const rows = flowRows.flatMap((flow) => {
    const version = latestByFlow.get(flow.id);
    if (!version) return [];
    return [
      {
        ...flow,
        version,
        displayStatus: flow.archivedAt ? ("archived" as const) : version.status,
        nodeCount: nodeCountByVersion.get(version.id) ?? 0,
        languages: [...(languagesByVersion.get(version.id) ?? [])],
      },
    ];
  });
  const query = search.q?.trim().toLocaleLowerCase(locale) ?? "";
  const requestedStatus = listStates.includes(
    search.status as (typeof listStates)[number],
  )
    ? search.status
    : "";
  const filteredRows = rows.filter((row) => {
    const searchable =
      `${row.internalName} ${row.slug} ${row.ownerName ?? t.platformOwner} ${row.cityName ?? row.cityCode ?? ""}`.toLocaleLowerCase(
        locale,
      );
    return (
      (!requestedStatus || row.displayStatus === requestedStatus) &&
      (!query || searchable.includes(query))
    );
  });
  const draftCount = rows.filter((row) => row.displayStatus === "draft").length;
  const reviewCount = rows.filter(
    (row) => row.version.reviewDueAt && row.version.reviewDueAt <= new Date(),
  ).length;
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  });

  return (
    <div className="px-4 py-7 md:px-7 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-brand mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
            <GitBranch className="size-4" aria-hidden />
            {t["editor.eyebrow"]}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-copy-muted mt-2 text-sm leading-relaxed">
            {t.sub}
          </p>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href={localizedPath("/dashboard/simulator/new", locale)} />
          }
        >
          <Plus aria-hidden />
          {t.newFlow}
        </Button>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-copy-muted py-14 text-center text-sm">
            {t.emptyHint}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-5">
          <dl className="border-line bg-surface grid overflow-hidden rounded-xl border sm:grid-cols-3">
            {[
              [t["list.total"], rows.length],
              [t["list.drafts"], draftCount],
              [t["list.reviewDue"], reviewCount],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-line grid gap-1 border-b px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0"
              >
                <dt className="text-copy-muted text-xs font-medium">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <form
            action={localizedPath("/dashboard/simulator", locale)}
            method="get"
            className="border-line bg-surface grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]"
          >
            <Input
              type="search"
              name="q"
              defaultValue={search.q ?? ""}
              placeholder={t["list.searchPlaceholder"]}
              aria-label={t["list.searchPlaceholder"]}
            />
            <NativeSelect
              name="status"
              defaultValue={requestedStatus}
              aria-label={t["list.filterState"]}
            >
              <NativeSelectOption value="">
                {t["list.allStates"]}
              </NativeSelectOption>
              {listStates.map((state) => (
                <NativeSelectOption key={state} value={state}>
                  {t[`status.${state}`]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button type="submit">
              <Search aria-hidden />
              {t["list.applyFilters"]}
            </Button>
          </form>

          <div className="border-line bg-surface overflow-hidden rounded-xl border">
            <div className="border-line bg-subtle text-copy-muted hidden grid-cols-[minmax(16rem,2fr)_minmax(9rem,1fr)_8rem_minmax(10rem,1fr)_9rem_2rem] gap-4 border-b px-5 py-3 text-xs font-medium md:grid">
              <span>{t["list.pathColumn"]}</span>
              <span>{t["list.ownerColumn"]}</span>
              <span>{t["list.statusColumn"]}</span>
              <span>{t["list.languagesColumn"]}</span>
              <span>{t["list.updatedColumn"]}</span>
              <span aria-hidden />
            </div>
            {filteredRows.length > 0 ? (
              <div aria-label={t.title} className="divide-line divide-y">
                {filteredRows.map((flow) => (
                  <div
                    key={flow.id}
                    className="hover:bg-subtle grid gap-4 px-5 py-4 transition-colors md:grid-cols-[minmax(16rem,2fr)_minmax(9rem,1fr)_8rem_minmax(10rem,1fr)_9rem_2rem] md:items-center"
                  >
                    <div className="min-w-0">
                      <Link
                        href={localizedPath(
                          `/dashboard/simulator/${flow.id}`,
                          locale,
                        )}
                        aria-label={t["list.open"].replace(
                          "{title}",
                          flow.internalName,
                        )}
                        className="hover:text-brand focus-visible:ring-brand truncate font-semibold focus-visible:rounded focus-visible:outline-none focus-visible:ring-2"
                      >
                        {flow.internalName}
                      </Link>
                      <p className="text-copy-muted mt-1 truncate text-xs">
                        /{flow.slug} ·{" "}
                        {t.version.replace(
                          "{number}",
                          String(flow.version.versionNumber),
                        )}{" "}
                        · {t.nodes.replace("{count}", String(flow.nodeCount))}
                      </p>
                    </div>
                    <p className="text-copy-muted truncate text-sm">
                      {flow.ownerName ?? t.platformOwner}
                      <span className="block text-xs">
                        {flow.cityName ?? flow.cityCode ?? t.allCities}
                      </span>
                    </p>
                    <div>
                      <Badge variant={statusVariant[flow.displayStatus]}>
                        {t[`status.${flow.displayStatus}`]}
                      </Badge>
                      {flow.version.reviewDueAt &&
                      flow.version.reviewDueAt <= new Date() ? (
                        <p className="text-warn mt-1 flex items-center gap-1 text-xs">
                          <CalendarClock className="size-3" aria-hidden />
                          {dateFormatter.format(flow.version.reviewDueAt)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {flow.languages.length > 0
                        ? flow.languages.map((language) => (
                            <span
                              key={language}
                              className="border-line text-copy-muted rounded border px-1.5 py-0.5 text-[0.7rem] font-medium"
                            >
                              {language === "fr" ||
                              language === "en" ||
                              language === "ar"
                                ? t[`language.${language}`]
                                : language}
                            </span>
                          ))
                        : "—"}
                    </div>
                    <time
                      dateTime={flow.updatedAt.toISOString()}
                      className="text-copy-muted text-sm tabular-nums"
                    >
                      {dateFormatter.format(flow.updatedAt)}
                    </time>
                    <SimulatorRowActions
                      locale={locale}
                      flowId={flow.id}
                      title={flow.internalName}
                      viewHref={localizedPath(
                        flow.displayStatus === "published"
                          ? `/simulator/${flow.slug}`
                          : `/simulator/preview/${flow.id}`,
                        locale,
                      )}
                      editHref={localizedPath(
                        `/dashboard/simulator/${flow.id}`,
                        locale,
                      )}
                      archived={flow.displayStatus === "archived"}
                      labels={{
                        actions: t["list.actions"],
                        view: t["list.view"],
                        edit: t["list.edit"],
                        delete: t["list.delete"],
                        deleteTitle: t["list.deleteTitle"],
                        deleteDescription: t["list.deleteDescription"],
                        deleteConfirm: t["list.deleteConfirm"],
                        deleteSuccess: t["list.deleteSuccess"],
                        deleteError: t["list.deleteError"],
                        cancel: t.cancel,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-copy-muted px-5 py-12 text-center text-sm">
                {t["list.noResults"]}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
