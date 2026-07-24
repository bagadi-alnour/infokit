import { formatMessage, type Locale } from "@calais/shared/i18n";
import {
  loadPageCatalog,
  type PageCatalog,
} from "@calais/shared/i18n/catalogs";
import { and, asc, count, eq, isNull, or } from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";
import { type ReactNode } from "react";

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TD,
  TH,
  TextInput,
} from "~/components/admin/workspace";
import { CatalogueNotice } from "~/components/admin/catalogue-notice";
import { DeleteButton } from "~/components/admin/delete-button";
import { EditCategoryButton } from "~/components/admin/edit-category-button";
import { EditServiceButton } from "~/components/admin/edit-service-button";
import { EditTagButton } from "~/components/admin/edit-tag-button";
import { IconPicker } from "~/components/admin/icon-picker";
import { TaxonomyIcon, taxonomyIconNames } from "~/components/taxonomy-icon";
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
import {
  createCategory,
  createService,
  createTag,
  deleteCategory,
  deleteService,
  deleteTag,
  setCategoryEnabled,
  setServiceActive,
  setTagActive,
  updateCategory,
  updateService,
  updateTag,
} from "./actions";

type Catalogue = PageCatalog<"dashboard-catalogue">;

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

export default async function CataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "dashboard-catalogue");
  const requestedOrg = (await searchParams).org;
  const user = await requireEditor(locale);

  const organizationRows = await db
    .select({ id: organizations.id, name: organizations.displayName })
    .from(organizations)
    .orderBy(asc(organizations.displayName));

  const scopeOrgId =
    (typeof requestedOrg === "string" ? requestedOrg : undefined) ??
    organizationRows[0]?.id;
  const scopeOrgName =
    organizationRows.find((org) => org.id === scopeOrgId)?.name ??
    t["catalogue.scope.organization"];

  const roleTest = await getRoleTestState(user.id, scopeOrgId);
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
  const categoryLabel = labelPicker(categoryNames, locale);
  const serviceName = labelPicker(serviceNames, locale);
  const tagNames = groupTranslations(tagLabelRows);
  const tagLabel = labelPicker(tagNames, locale);
  const tagLabelFr = (id: string, fallback: string) =>
    tagNames.get(id)?.fr ?? fallback;
  const serviceUsage = new Map(serviceUsageRows.map((r) => [r.id, r.n]));
  const categoryUsage = new Map(categoryUsageRows.map((r) => [r.id, r.n]));
  const enabledCategories = categoryRows.filter((c) => c.enabled);

  const canEditRow = (organizationId: string | null) =>
    organizationId === null ? canManageGlobal : canManageOrg;

  // A row is deletable only when nothing references it, anywhere.
  const usedServiceIds = new Set<string>([
    ...serviceUsageRows.map((r) => r.id),
    ...serviceEditorialUsageRows.map((r) => r.id),
  ]);
  const usedTagIds = new Set<string>([
    ...tagActivityUsageRows.map((r) => r.id),
    ...tagEditorialUsageRows.map((r) => r.id),
  ]);
  const deleteLabels = {
    delete: t["catalogue.delete"],
    confirm: t["catalogue.deleteConfirm"],
    hint: t["catalogue.deleteHint"],
    cancel: t["catalogue.cancel"],
  };

  // The French name is the canonical label the editor adjusts; every category
  // is offered (even disabled ones) so a service keeps its current category.
  const serviceNameFr = (id: string, fallback: string) =>
    serviceNames.get(id)?.fr ?? fallback;
  const categoryOptions = categoryRows.map((category) => ({
    id: category.id,
    label: categoryLabel(category.id, category.code),
  }));
  const editServiceLabels = {
    edit: t["catalogue.services.edit"],
    name: t["catalogue.services.nameFr"],
    category: t["catalogue.services.category"],
    icon: t["catalogue.services.icon"],
    save: t["catalogue.services.save"],
    searchIcons: t["catalogue.icon.search"],
    emptyIcons: t["catalogue.icon.empty"],
  };
  const editCategoryLabels = {
    edit: t["catalogue.categories.edit"],
    name: t["catalogue.categories.labelFr"],
    icon: t["catalogue.categories.icon"],
    save: t["catalogue.save"],
    searchIcons: t["catalogue.icon.search"],
    emptyIcons: t["catalogue.icon.empty"],
  };
  const editTagLabels = {
    edit: t["catalogue.tags.edit"],
    name: t["catalogue.tags.labelFr"],
    namespace: t["catalogue.tags.namespace"],
    color: t["catalogue.tags.color"],
    visibility: t["catalogue.tags.visibility"],
    visibilityPublic: t["catalogue.tags.visibility.public"],
    visibilityWorkspace: t["catalogue.tags.visibility.workspace"],
    save: t["catalogue.save"],
  };

  return (
    <div className="px-4 py-6 md:px-6">
      <CatalogueNotice
        duplicateNameMessage={t["catalogue.duplicateName"]}
        inUseMessage={t["catalogue.inUse"]}
      />
      <PageHeader
        title={t["catalogue.title"]}
        sub={t["catalogue.description"]}
      />

      <div className="grid gap-6">
        {/* ---------------------------------- Services --------------------------------- */}
        <Section>
          <Card
            title={formatMessage(t["catalogue.services.count"], {
              count: String(serviceRows.length),
            })}
          >
            {serviceRows.length === 0 ? (
              <EmptyState>{t["catalogue.services.empty"]}</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TH>{t["catalogue.services.title"]}</TH>
                    <TH>{t["catalogue.services.category"]}</TH>
                    <TH>{t["catalogue.services.scope"]}</TH>
                    <TH className="text-end">
                      {t["catalogue.services.usage"]
                        .replace("{count}", "")
                        .trim()}
                    </TH>
                    <TH className="text-end">{t["catalogue.status.active"]}</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceRows.map((service) => (
                    <TableRow key={service.id}>
                      <TD>
                        <span className="flex items-center gap-2">
                          <TaxonomyIcon name={service.icon} size={16} />
                          <span className="font-medium">
                            {serviceName(service.id, service.code ?? "—")}
                          </span>
                        </span>
                        {service.code ? (
                          <p className="text-copy-muted ms-6 text-xs">
                            {service.code}
                          </p>
                        ) : null}
                      </TD>
                      <TD className="text-copy-muted text-xs">
                        {categoryLabel(service.categoryId, "—")}
                      </TD>
                      <TD>
                        <ScopeChip
                          organizationId={service.organizationId}
                          t={t}
                        />
                      </TD>
                      <TD className="text-end tabular-nums">
                        {serviceUsage.get(service.id) ?? 0}
                      </TD>
                      <TD className="text-end">
                        <span className="inline-flex items-center justify-end gap-1">
                          {canEditRow(service.organizationId) ? (
                            <EditServiceButton
                              action={updateService}
                              locale={locale}
                              serviceId={service.id}
                              organizationId={service.organizationId}
                              name={serviceNameFr(
                                service.id,
                                service.code ?? "",
                              )}
                              icon={service.icon}
                              categoryId={service.categoryId}
                              categories={categoryOptions}
                              icons={taxonomyIconNames}
                              labels={editServiceLabels}
                            />
                          ) : null}
                          {canEditRow(service.organizationId) &&
                          !usedServiceIds.has(service.id) ? (
                            <DeleteButton
                              action={deleteService}
                              idName="serviceId"
                              id={service.id}
                              organizationId={service.organizationId}
                              locale={locale}
                              labels={deleteLabels}
                            />
                          ) : null}
                          <ActiveControl
                            action={setServiceActive}
                            idName="serviceId"
                            id={service.id}
                            active={service.active}
                            organizationId={service.organizationId}
                            canEdit={canEditRow(service.organizationId)}
                            locale={locale}
                            t={t}
                          />
                        </span>
                      </TD>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          {canManageGlobal || canManageOrg ? (
            <Card title={t["catalogue.services.new"]}>
              <form action={createService} className="grid gap-3">
                <input type="hidden" name="locale" value={locale} />
                {scopeOrgId ? (
                  <input
                    type="hidden"
                    name="organizationId"
                    value={scopeOrgId}
                  />
                ) : null}
                <ScopeField
                  canManageGlobal={canManageGlobal}
                  canManageOrg={canManageOrg}
                  scopeOrgName={scopeOrgName}
                  t={t}
                />
                <Field label={t["catalogue.services.nameFr"]}>
                  <TextInput name="nameFr" required minLength={2} />
                </Field>
                <Field label={t["catalogue.services.category"]}>
                  <Select name="categoryId" required defaultValue="">
                    <option value="" disabled>
                      —
                    </option>
                    {enabledCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryLabel(category.id, category.code)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <IconField
                  name="icon"
                  label={t["catalogue.services.icon"]}
                  t={t}
                />
                <Field
                  label={t["catalogue.services.code"]}
                  hint={t["catalogue.services.codeHint"]}
                >
                  <TextInput name="code" placeholder="hot_shower" />
                </Field>
                <details className="text-copy-muted text-sm">
                  <summary className="cursor-pointer">
                    {t["catalogue.optional"]}
                  </summary>
                  <div className="mt-2 grid gap-3">
                    <Field label={t["catalogue.services.nameEn"]}>
                      <TextInput name="nameEn" />
                    </Field>
                    <Field label={t["catalogue.services.nameAr"]}>
                      <TextInput name="nameAr" dir="rtl" />
                    </Field>
                  </div>
                </details>
                <Button disabled={enabledCategories.length === 0}>
                  {t["catalogue.services.create"]}
                </Button>
              </form>
            </Card>
          ) : null}
        </Section>

        {/* --------------------------------- Categories -------------------------------- */}
        <Section>
          <Card
            title={formatMessage(t["catalogue.categories.count"], {
              count: String(categoryRows.length),
            })}
          >
            <p className="text-copy-muted mb-3 text-xs">
              {t["catalogue.categories.note"]}
            </p>
            {categoryRows.length === 0 ? (
              <EmptyState>{t["catalogue.categories.empty"]}</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TH>{t["catalogue.categories.title"]}</TH>
                    <TH className="text-end">
                      {t["catalogue.categories.services"]
                        .replace("{count}", "")
                        .trim()}
                    </TH>
                    <TH className="text-end">
                      {t["catalogue.status.enabled"]}
                    </TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRows.map((category) => (
                    <TableRow key={category.id}>
                      <TD>
                        <span className="flex items-center gap-2">
                          <TaxonomyIcon name={category.icon} size={16} />
                          <span className="font-medium">
                            {categoryLabel(category.id, category.code)}
                          </span>
                        </span>
                        <p className="text-copy-muted ms-6 text-xs">
                          {category.code}
                        </p>
                      </TD>
                      <TD className="text-end tabular-nums">
                        {categoryUsage.get(category.id) ?? 0}
                      </TD>
                      <TD className="text-end">
                        <span className="inline-flex items-center justify-end gap-1">
                          {canManageGlobal ? (
                            <EditCategoryButton
                              action={updateCategory}
                              locale={locale}
                              categoryId={category.id}
                              name={categoryLabel(category.id, category.code)}
                              icon={category.icon}
                              icons={taxonomyIconNames}
                              labels={editCategoryLabels}
                            />
                          ) : null}
                          {canManageGlobal &&
                          (categoryUsage.get(category.id) ?? 0) === 0 ? (
                            <DeleteButton
                              action={deleteCategory}
                              idName="categoryId"
                              id={category.id}
                              organizationId={null}
                              locale={locale}
                              labels={deleteLabels}
                            />
                          ) : null}
                          <ActiveControl
                            action={setCategoryEnabled}
                            idName="categoryId"
                            id={category.id}
                            active={category.enabled}
                            activeField="enabled"
                            organizationId={null}
                            canEdit={canManageGlobal}
                            locale={locale}
                            t={t}
                            enableLabel={t["catalogue.action.enable"]}
                            disableLabel={t["catalogue.action.disable"]}
                          />
                        </span>
                      </TD>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          {canManageGlobal ? (
            <Card title={t["catalogue.categories.new"]}>
              <form action={createCategory} className="grid gap-3">
                <input type="hidden" name="locale" value={locale} />
                <Field label={t["catalogue.categories.labelFr"]}>
                  <TextInput name="labelFr" required minLength={2} />
                </Field>
                <IconField
                  name="icon"
                  label={t["catalogue.categories.icon"]}
                  t={t}
                />
                <Field label={t["catalogue.categories.code"]}>
                  <TextInput name="code" placeholder="hygiene" required />
                </Field>
                <details className="text-copy-muted text-sm">
                  <summary className="cursor-pointer">
                    {t["catalogue.optional"]}
                  </summary>
                  <div className="mt-2 grid gap-3">
                    <Field label={t["catalogue.categories.labelEn"]}>
                      <TextInput name="labelEn" />
                    </Field>
                    <Field label={t["catalogue.categories.labelAr"]}>
                      <TextInput name="labelAr" dir="rtl" />
                    </Field>
                  </div>
                </details>
                <Button>{t["catalogue.categories.create"]}</Button>
              </form>
            </Card>
          ) : (
            <ReadonlyCard>{t["catalogue.readonly"]}</ReadonlyCard>
          )}
        </Section>

        {/* ------------------------------------ Tags ----------------------------------- */}
        <Section>
          <Card
            title={formatMessage(t["catalogue.tags.count"], {
              count: String(tagRows.length),
            })}
          >
            <p className="text-copy-muted mb-3 text-xs">
              {t["catalogue.tags.note"]}
            </p>
            {tagRows.length === 0 ? (
              <EmptyState>{t["catalogue.tags.empty"]}</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TH>{t["catalogue.tags.title"]}</TH>
                    <TH>{t["catalogue.tags.namespace"]}</TH>
                    <TH>{t["catalogue.tags.visibility"]}</TH>
                    <TH>{t["catalogue.tags.scope"]}</TH>
                    <TH className="text-end">{t["catalogue.status.active"]}</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tagRows.map((tag) => (
                    <TableRow key={tag.id}>
                      <TD>
                        <span className="font-medium">
                          {tagLabel(tag.id, tag.code)}
                        </span>
                        <p className="text-copy-muted text-xs">{tag.code}</p>
                      </TD>
                      <TD className="text-copy-muted text-xs">
                        {tag.namespace}
                      </TD>
                      <TD className="text-copy-muted text-xs">
                        {tag.visibility === "public"
                          ? t["catalogue.tags.visibility.public"]
                          : t["catalogue.tags.visibility.workspace"]}
                      </TD>
                      <TD>
                        <ScopeChip organizationId={tag.organizationId} t={t} />
                      </TD>
                      <TD className="text-end">
                        <span className="inline-flex items-center justify-end gap-1">
                          {canEditRow(tag.organizationId) ? (
                            <EditTagButton
                              action={updateTag}
                              locale={locale}
                              tagId={tag.id}
                              organizationId={tag.organizationId}
                              name={tagLabelFr(tag.id, tag.code)}
                              namespace={tag.namespace}
                              colorToken={tag.colorToken}
                              visibility={tag.visibility}
                              labels={editTagLabels}
                            />
                          ) : null}
                          {canEditRow(tag.organizationId) &&
                          !usedTagIds.has(tag.id) ? (
                            <DeleteButton
                              action={deleteTag}
                              idName="tagId"
                              id={tag.id}
                              organizationId={tag.organizationId}
                              locale={locale}
                              labels={deleteLabels}
                            />
                          ) : null}
                          <ActiveControl
                            action={setTagActive}
                            idName="tagId"
                            id={tag.id}
                            active={tag.active}
                            organizationId={tag.organizationId}
                            canEdit={canEditRow(tag.organizationId)}
                            locale={locale}
                            t={t}
                          />
                        </span>
                      </TD>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          {canManageGlobal || canManageOrg ? (
            <Card title={t["catalogue.tags.new"]}>
              <form action={createTag} className="grid gap-3">
                <input type="hidden" name="locale" value={locale} />
                {scopeOrgId ? (
                  <input
                    type="hidden"
                    name="organizationId"
                    value={scopeOrgId}
                  />
                ) : null}
                <ScopeField
                  canManageGlobal={canManageGlobal}
                  canManageOrg={canManageOrg}
                  scopeOrgName={scopeOrgName}
                  t={t}
                />
                <Field label={t["catalogue.tags.labelFr"]}>
                  <TextInput name="labelFr" required minLength={2} />
                </Field>
                <Field label={t["catalogue.tags.code"]}>
                  <TextInput name="code" placeholder="winter" required />
                </Field>
                <Field
                  label={t["catalogue.tags.namespace"]}
                  hint={t["catalogue.tags.namespaceHint"]}
                >
                  <TextInput name="namespace" defaultValue="topic" />
                </Field>
                <Field label={t["catalogue.tags.visibility"]}>
                  <Select name="visibility" defaultValue="public">
                    <option value="public">
                      {t["catalogue.tags.visibility.public"]}
                    </option>
                    <option value="workspace">
                      {t["catalogue.tags.visibility.workspace"]}
                    </option>
                  </Select>
                </Field>
                <Field label={t["catalogue.tags.color"]}>
                  <Select name="colorToken" defaultValue="neutral">
                    {["neutral", "accent", "ok", "warn", "danger"].map(
                      (tone) => (
                        <option key={tone} value={tone}>
                          {tone}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>
                <details className="text-copy-muted text-sm">
                  <summary className="cursor-pointer">
                    {t["catalogue.optional"]}
                  </summary>
                  <div className="mt-2 grid gap-3">
                    <Field label={t["catalogue.tags.labelEn"]}>
                      <TextInput name="labelEn" />
                    </Field>
                    <Field label={t["catalogue.tags.labelAr"]}>
                      <TextInput name="labelAr" dir="rtl" />
                    </Field>
                  </div>
                </details>
                <Button>{t["catalogue.tags.create"]}</Button>
              </form>
            </Card>
          ) : null}
        </Section>
      </div>
    </div>
  );
}

/** Two-column section: record list beside its "new" form. */
function Section({ children }: { children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
      {children}
    </div>
  );
}

function ScopeChip({
  organizationId,
  t,
}: {
  organizationId: string | null;
  t: Catalogue;
}) {
  return organizationId === null ? (
    <Chip tone="neutral">{t["catalogue.scope.chip.global"]}</Chip>
  ) : (
    <Chip tone="accent">{t["catalogue.scope.chip.org"]}</Chip>
  );
}

function ReadonlyCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className="text-copy-muted text-sm">{children}</p>
    </Card>
  );
}

function IconField({
  name,
  label,
  t,
}: {
  name: string;
  label: string;
  t: Catalogue;
}) {
  return (
    <Field label={label}>
      <IconPicker
        name={name}
        icons={taxonomyIconNames}
        ariaLabel={label}
        searchLabel={t["catalogue.icon.search"]}
        emptyLabel={t["catalogue.icon.empty"]}
      />
    </Field>
  );
}

/**
 * Scope chooser: platform vs this association. Rendered as a select only when
 * the editor can write both scopes; otherwise the single allowed scope is a
 * hidden field.
 */
function ScopeField({
  canManageGlobal,
  canManageOrg,
  scopeOrgName,
  t,
}: {
  canManageGlobal: boolean;
  canManageOrg: boolean;
  scopeOrgName: string;
  t: Catalogue;
}) {
  if (canManageGlobal && canManageOrg) {
    return (
      <Field label={t["catalogue.services.scope"]}>
        <Select name="scope" defaultValue="org">
          <option value="org">{scopeOrgName}</option>
          <option value="global">{t["catalogue.scope.global"]}</option>
        </Select>
      </Field>
    );
  }
  return (
    <input type="hidden" name="scope" value={canManageOrg ? "org" : "global"} />
  );
}

/** Toggle a row's active/enabled flag; renders nothing editable without rights. */
function ActiveControl({
  action,
  idName,
  id,
  active,
  activeField = "active",
  organizationId,
  canEdit,
  locale,
  t,
  enableLabel,
  disableLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  idName: string;
  id: string;
  active: boolean;
  activeField?: string;
  organizationId: string | null;
  canEdit: boolean;
  locale: Locale;
  t: Catalogue;
  enableLabel?: string;
  disableLabel?: string;
}) {
  const activeChip = (
    <Chip tone={active ? "ok" : "neutral"}>
      {active ? t["catalogue.status.active"] : t["catalogue.status.inactive"]}
    </Chip>
  );
  if (!canEdit) return activeChip;
  const on = enableLabel ?? t["catalogue.action.activate"];
  const off = disableLabel ?? t["catalogue.action.deactivate"];
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name={idName} value={id} />
      <input
        type="hidden"
        name={activeField}
        value={active ? "false" : "true"}
      />
      <input
        type="hidden"
        name="scope"
        value={organizationId === null ? "global" : "org"}
      />
      {organizationId ? (
        <input type="hidden" name="organizationId" value={organizationId} />
      ) : null}
      <Button variant="ghost" className="text-xs font-medium">
        {active ? off : on}
      </Button>
    </form>
  );
}
