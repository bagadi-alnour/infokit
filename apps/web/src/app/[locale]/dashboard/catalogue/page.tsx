import { type Locale } from "@infokit/shared/i18n";
import { loadCatalog, loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, count, eq, isNull, or } from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";

import { CatalogueNotice } from "~/components/admin/catalogue-notice";
import type {
  CatalogueCategoryRow,
  CatalogueLabels,
  CatalogueServiceRow,
  CatalogueTagRow,
} from "~/components/admin/catalogue-rows";
import { CatalogueWorkspace } from "~/components/admin/catalogue-workspace";
import {
  Chip,
  Notice,
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { getRoleTestState } from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activityServices,
  activityTags,
  editorialEntryTags,
  editorialRelatedServices,
  organizations,
  serviceCategories,
  serviceCategoryTranslations,
  services,
  serviceTranslations,
  tags,
  tagTranslations,
} from "~/server/db/schema";

/** Best available label for a row: current locale, then French, then a fallback. */
function labelPicker(
  byId: Map<string, Record<string, string>>,
  locale: Locale,
) {
  return (id: string, fallback: string) =>
    byId.get(id)?.[locale] ?? byId.get(id)?.fr ?? fallback;
}

function groupTranslations(
  rows: { id: string; languageCode: string; value: string }[],
) {
  const byId = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const existing = byId.get(row.id) ?? {};
    existing[row.languageCode] = row.value;
    byId.set(row.id, existing);
  }
  return byId;
}

/**
 * The catalogue: services, their categories, and tags.
 *
 * The page reads all three lists, resolves every label to the reader's
 * language, and counts what references each row — then hands flat rows to the
 * tabs. Deciding here what may be edited or deleted means a table never shows
 * a control the server would refuse (docs/PRODUCT.md §11.4).
 */
export default async function CataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [t, console_] = await Promise.all([
    loadPageCatalog(locale, "dashboard-catalogue"),
    loadCatalog(locale, "dashboard-console"),
  ]);
  const requestedOrg = (await searchParams).org;
  const user = await requireEditor(locale);

  const organizationRows = await db
    .select({ id: organizations.id, name: organizations.displayName })
    .from(organizations)
    .orderBy(asc(organizations.displayName));

  const scopeOrgId =
    (typeof requestedOrg === "string" ? requestedOrg : undefined) ??
    organizationRows[0]?.id ??
    null;
  const scopeOrgName =
    organizationRows.find((org) => org.id === scopeOrgId)?.name ??
    t["catalogue.scope.organization"];

  const roleTest = await getRoleTestState(user.id, scopeOrgId ?? undefined);
  const canManageGlobal = roleTest.effectivePermissions.has("taxonomy.manage");
  const canManageOrg =
    !!scopeOrgId &&
    roleTest.effectivePermissions.has("content.activity.manage");

  const orgScopeFilter = (column: AnyPgColumn) =>
    scopeOrgId ? or(isNull(column), eq(column, scopeOrgId)) : isNull(column);

  const [
    categoryRows,
    categoryLabelRows,
    serviceRows,
    serviceNameRows,
    serviceUsageRows,
    categoryUsageRows,
    serviceEditorialUsageRows,
    tagActivityUsageRows,
    tagEditorialUsageRows,
    tagRows,
    tagLabelRows,
  ] = await Promise.all([
    db
      .select({
        id: serviceCategories.id,
        code: serviceCategories.code,
        icon: serviceCategories.icon,
        enabled: serviceCategories.enabled,
        displayOrder: serviceCategories.displayOrder,
      })
      .from(serviceCategories)
      .orderBy(
        asc(serviceCategories.displayOrder),
        asc(serviceCategories.code),
      ),
    db
      .select({
        id: serviceCategoryTranslations.categoryId,
        languageCode: serviceCategoryTranslations.languageCode,
        value: serviceCategoryTranslations.label,
      })
      .from(serviceCategoryTranslations),
    db
      .select({
        id: services.id,
        code: services.code,
        icon: services.icon,
        categoryId: services.categoryId,
        organizationId: services.organizationId,
        active: services.active,
        // Workspace-only: who to ask about this row. Never published.
        stewardName: services.stewardName,
        stewardPhone: services.stewardPhone,
        stewardEmail: services.stewardEmail,
      })
      .from(services)
      .where(
        and(
          isNull(services.archivedAt),
          orgScopeFilter(services.organizationId),
        ),
      )
      .orderBy(asc(services.code)),
    db
      .select({
        id: serviceTranslations.serviceId,
        languageCode: serviceTranslations.languageCode,
        value: serviceTranslations.name,
      })
      .from(serviceTranslations),
    db
      .select({ id: activityServices.serviceId, n: count() })
      .from(activityServices)
      .groupBy(activityServices.serviceId),
    db
      .select({ id: services.categoryId, n: count() })
      .from(services)
      .where(isNull(services.archivedAt))
      .groupBy(services.categoryId),
    db
      .select({ id: editorialRelatedServices.serviceId, n: count() })
      .from(editorialRelatedServices)
      .groupBy(editorialRelatedServices.serviceId),
    db
      .select({ id: activityTags.tagId, n: count() })
      .from(activityTags)
      .groupBy(activityTags.tagId),
    db
      .select({ id: editorialEntryTags.tagId, n: count() })
      .from(editorialEntryTags)
      .groupBy(editorialEntryTags.tagId),
    db
      .select({
        id: tags.id,
        code: tags.code,
        namespace: tags.namespace,
        colorToken: tags.colorToken,
        visibility: tags.visibility,
        organizationId: tags.organizationId,
        active: tags.active,
      })
      .from(tags)
      .where(orgScopeFilter(tags.organizationId))
      .orderBy(asc(tags.namespace), asc(tags.code)),
    db
      .select({
        id: tagTranslations.tagId,
        languageCode: tagTranslations.languageCode,
        value: tagTranslations.label,
      })
      .from(tagTranslations),
  ]);

  const categoryNames = groupTranslations(categoryLabelRows);
  const serviceNames = groupTranslations(serviceNameRows);
  const tagNames = groupTranslations(tagLabelRows);
  const categoryLabel = labelPicker(categoryNames, locale);
  const serviceName = labelPicker(serviceNames, locale);
  const tagLabel = labelPicker(tagNames, locale);

  const serviceUsage = new Map(serviceUsageRows.map((row) => [row.id, row.n]));
  const serviceEditorialUsage = new Map(
    serviceEditorialUsageRows.map((row) => [row.id, row.n]),
  );
  const categoryUsage = new Map(
    categoryUsageRows.map((row) => [row.id, row.n]),
  );
  // A tag can be worn by both an activity and an article; the reader cares how
  // many things wear it, not which table they came from.
  const tagUsage = new Map<string, number>();
  for (const row of [...tagActivityUsageRows, ...tagEditorialUsageRows]) {
    tagUsage.set(row.id, (tagUsage.get(row.id) ?? 0) + row.n);
  }

  // The French label is the canonical one the inline editors write.
  const frenchLabel = (
    byId: Map<string, Record<string, string>>,
    id: string,
    fallback: string,
  ) => byId.get(id)?.fr ?? fallback;
  const canEditRow = (organizationId: string | null) =>
    organizationId === null ? canManageGlobal : canManageOrg;

  const serviceTableRows: CatalogueServiceRow[] = serviceRows.map((service) => {
    const referenced =
      (serviceUsage.get(service.id) ?? 0) +
      (serviceEditorialUsage.get(service.id) ?? 0);
    const canEdit = canEditRow(service.organizationId);
    return {
      id: service.id,
      name: serviceName(service.id, service.code ?? "—"),
      nameFr: frenchLabel(serviceNames, service.id, service.code ?? ""),
      code: service.code,
      icon: service.icon,
      categoryId: service.categoryId,
      categoryLabel: categoryLabel(service.categoryId, "—"),
      organizationId: service.organizationId,
      active: service.active,
      usageCount: referenced,
      steward: {
        stewardName: service.stewardName,
        stewardPhone: service.stewardPhone,
        stewardEmail: service.stewardEmail,
      },
      canEdit,
      // Deleting a row something still points at would orphan that reference.
      canDelete: canEdit && referenced === 0,
    };
  });

  const categoryTableRows: CatalogueCategoryRow[] = categoryRows.map(
    (category) => ({
      id: category.id,
      label: categoryLabel(category.id, category.code),
      code: category.code,
      icon: category.icon,
      enabled: category.enabled,
      displayOrder: category.displayOrder,
      serviceCount: categoryUsage.get(category.id) ?? 0,
      canEdit: canManageGlobal,
      canDelete: canManageGlobal && (categoryUsage.get(category.id) ?? 0) === 0,
    }),
  );

  const tagTableRows: CatalogueTagRow[] = tagRows.map((tag) => {
    const canEdit = canEditRow(tag.organizationId);
    const used = tagUsage.get(tag.id) ?? 0;
    return {
      id: tag.id,
      label: tagLabel(tag.id, tag.code),
      labelFr: frenchLabel(tagNames, tag.id, tag.code),
      code: tag.code,
      namespace: tag.namespace,
      visibility: tag.visibility,
      colorToken: tag.colorToken,
      organizationId: tag.organizationId,
      active: tag.active,
      usageCount: used,
      canEdit,
      canDelete: canEdit && used === 0,
    };
  });

  const categoryOptions = categoryRows.map((category) => ({
    id: category.id,
    label: categoryLabel(category.id, category.code),
  }));
  const enabledCategoryOptions = categoryRows
    .filter((category) => category.enabled)
    .map((category) => ({
      id: category.id,
      label: categoryLabel(category.id, category.code),
    }));

  // What an editor can no longer pick: the one count on this page that asks
  // for a decision rather than reporting a size.
  const turnedOff =
    serviceTableRows.filter((row) => !row.active).length +
    categoryTableRows.filter((row) => !row.enabled).length +
    tagTableRows.filter((row) => !row.active).length;

  const labels: CatalogueLabels = {
    ...t,
    shared: console_,
    table: {
      search: console_["console.search"],
      searchPlaceholder: console_["console.search"],
      columns: console_["table.columns"],
      clear: console_["table.clearSearch"],
      noMatch: console_["console.filter.noMatch"],
      rowsPerPage: console_["table.rowsPerPage"],
      results: console_["table.results"],
      page: console_["table.page"],
      previous: console_["table.previousPage"],
      next: console_["table.nextPage"],
    },
  };

  return (
    <WorkspacePage>
      <CatalogueNotice
        duplicateNameMessage={t["catalogue.duplicateName"]}
        inUseMessage={t["catalogue.inUse"]}
      />
      <PageHeader
        title={t["catalogue.title"]}
        sub={t["catalogue.description"]}
        badges={
          canManageOrg ? (
            <Chip tone="accent">{scopeOrgName}</Chip>
          ) : (
            <Chip tone="neutral">{t["catalogue.scope.global"]}</Chip>
          )
        }
      />

      {canManageGlobal || canManageOrg ? null : (
        <Notice title={t["catalogue.readonly"]} />
      )}

      <StatGrid>
        <Stat
          label={t["catalogue.stat.services"]}
          value={serviceTableRows.length}
        />
        <Stat
          label={t["catalogue.stat.categories"]}
          value={categoryTableRows.length}
        />
        <Stat label={t["catalogue.stat.tags"]} value={tagTableRows.length} />
        <Stat
          label={t["catalogue.stat.hidden"]}
          value={turnedOff}
          hint={t["catalogue.stat.hiddenHint"]}
        />
      </StatGrid>

      <CatalogueWorkspace
        services={serviceTableRows}
        categories={categoryTableRows}
        tags={tagTableRows}
        categoryOptions={categoryOptions}
        enabledCategoryOptions={enabledCategoryOptions}
        rights={{ canManageGlobal, canManageOrg, scopeOrgId, scopeOrgName }}
        locale={locale}
        labels={labels}
      />
    </WorkspacePage>
  );
}
