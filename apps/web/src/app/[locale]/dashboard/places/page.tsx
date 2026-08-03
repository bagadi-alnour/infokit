import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, desc, eq } from "drizzle-orm";

import { CreatePlaceDialog } from "~/components/admin/create-place-dialog";
import { PlacesTable } from "~/components/admin/places-table";
import {
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { denyPageAccess, hasPermission } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  cities,
  cityAreas,
  organizations,
  places,
  placeTranslations,
} from "~/server/db/schema";

export default async function PlacesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [messages, shared] = await Promise.all([
    loadPageCatalog(locale, "dashboard-places"),
    // The steward contact reads from the shared console catalogue, so the
    // wording is the same on every content type.
    loadPageCatalog(locale, "dashboard-console"),
  ]);
  /**
   * This page is one list and one form, and all three place mutations ask for
   * this grant (places/actions.ts). Without it there is nothing here to do — and
   * the form's owner picker names every association, which is directory
   * knowledge (server/auth/authorization.ts).
   */
  if (!(await hasPermission("content.activity.manage"))) {
    await denyPageAccess("content.activity.manage", locale);
  }
  const precisionLabel = {
    exact: messages["places.precision.exact"],
    area_only: messages["places.precision.areaOnly"],
    contact_to_learn: messages["places.precision.contact"],
  } as const;
  const [calais] = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.code, "calais"));
  if (!calais) throw new Error("Seed the database first: pnpm db:seed");

  const areas = await db
    .select({ id: cityAreas.id, code: cityAreas.code })
    .from(cityAreas)
    .where(eq(cityAreas.cityId, calais.id))
    .orderBy(cityAreas.displayOrder);

  const orgs = await db
    .select({ id: organizations.id, name: organizations.displayName })
    .from(organizations)
    .orderBy(organizations.displayName);

  const rows = await db
    .select({
      id: places.id,
      precision: places.precision,
      addressLine: places.addressLine,
      name: placeTranslations.name,
      org: organizations.displayName,
      areaCode: cityAreas.code,
    })
    .from(places)
    .leftJoin(
      placeTranslations,
      and(
        eq(placeTranslations.placeId, places.id),
        eq(placeTranslations.languageCode, "fr"),
      ),
    )
    .leftJoin(organizations, eq(places.organizationId, organizations.id))
    .leftJoin(cityAreas, eq(places.cityAreaId, cityAreas.id))
    .orderBy(desc(places.createdAt));

  return (
    <WorkspacePage>
      <PageHeader
        title={messages["places.title"]}
        sub={messages["places.description"]}
      />
      {/* Two figures, and the second is the one that matters: how many locations
       * are deliberately not published exactly. That is the decision this page
       * exists to record, so it is counted rather than left to be inferred by
       * scrolling the precision column. */}
      <StatGrid>
        <Stat label={messages["places.stat.total"]} value={rows.length} />
        <Stat
          label={messages["places.stat.exact"]}
          value={rows.filter((place) => place.precision === "exact").length}
        />
        <Stat
          label={messages["places.stat.protected"]}
          value={rows.filter((place) => place.precision !== "exact").length}
          hint={messages["places.stat.protectedHint"]}
        />
      </StatGrid>

      <PlacesTable
        rows={rows.map((place) => ({
          id: place.id,
          name: place.name ?? messages["places.noName"],
          organization: place.org,
          area: place.areaCode,
          address: place.addressLine,
          precision: place.precision,
          precisionLabel: precisionLabel[place.precision],
        }))}
        labels={{
          search: shared["console.search"],
          searchPlaceholder: messages["places.searchPlaceholder"],
          columns: shared["table.columns"],
          clear: shared["table.clearSearch"],
          filterBy: shared["table.filterBy"],
          noMatch: messages["places.empty"],
          rowsPerPage: shared["table.rowsPerPage"],
          results: shared["table.results"],
          page: shared["table.page"],
          previous: shared["table.previousPage"],
          next: shared["table.nextPage"],
          place: messages["places.nameColumn"],
          organization: messages["places.organization"],
          area: messages["places.areaColumn"],
          address: messages["places.addressColumn"],
          precision: messages["places.precisionColumn"],
        }}
        createAction={
          <CreatePlaceDialog
            locale={locale}
            cityId={calais.id}
            organizations={orgs.map((org) => ({
              id: org.id,
              label: org.name,
            }))}
            areas={areas.map((area) => ({ id: area.id, label: area.code }))}
            labels={messages}
            stewardLabels={shared}
          />
        }
      />
    </WorkspacePage>
  );
}
