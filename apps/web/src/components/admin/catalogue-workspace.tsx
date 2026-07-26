"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { CatalogueCategoriesPanel } from "./catalogue-categories-panel";
import type {
  CatalogueCategoryOption,
  CatalogueCategoryRow,
  CatalogueLabels,
  CatalogueRights,
  CatalogueServiceRow,
  CatalogueTagRow,
} from "./catalogue-rows";
import { CatalogueServicesPanel } from "./catalogue-services-panel";
import { CatalogueTagsPanel } from "./catalogue-tags-panel";

/**
 * The catalogue as three tabs over one table.
 *
 * Services, categories and tags are three different questions ("what do we
 * offer", "how is it grouped", "how is it labelled") and an editor asks one at
 * a time. Stacking all three lists on one page meant scrolling past two to
 * reach the third; one table at a time keeps search, filters and paging in the
 * same place whichever question is being asked (docs/DESIGN-SYSTEM.md §5).
 */
export function CatalogueWorkspace({
  services,
  categories,
  tags,
  categoryOptions,
  enabledCategoryOptions,
  rights,
  locale,
  labels,
}: {
  services: CatalogueServiceRow[];
  categories: CatalogueCategoryRow[];
  tags: CatalogueTagRow[];
  categoryOptions: CatalogueCategoryOption[];
  enabledCategoryOptions: CatalogueCategoryOption[];
  rights: CatalogueRights;
  locale: Locale;
  labels: CatalogueLabels;
}) {
  return (
    <Tabs defaultValue="services">
      <div className="mb-4 overflow-x-auto pb-1">
        <TabsList
          variant="line"
          aria-label={labels["catalogue.tabs.label"]}
          className="group-data-horizontal/tabs:h-auto w-max min-w-full justify-start gap-x-1 pb-1"
        >
          <TabsTrigger value="services" className="flex-none">
            <TabLabel count={services.length}>
              {labels["catalogue.services.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex-none">
            <TabLabel count={categories.length}>
              {labels["catalogue.categories.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex-none">
            <TabLabel count={tags.length}>
              {labels["catalogue.tags.title"]}
            </TabLabel>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="services">
        <CatalogueServicesPanel
          rows={services}
          categories={categoryOptions}
          enabledCategories={enabledCategoryOptions}
          rights={rights}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="categories">
        <CatalogueCategoriesPanel
          rows={categories}
          canManage={rights.canManageGlobal}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="tags">
        <CatalogueTagsPanel
          rows={tags}
          rights={rights}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
    </Tabs>
  );
}

/** How much is behind a tab, so the choice is informed before the click. */
function TabLabel({ count, children }: { count: number; children: ReactNode }) {
  return (
    <>
      {children}
      <span className="text-copy-muted text-xs tabular-nums">{count}</span>
    </>
  );
}
