import { formatMessage } from "@calais/shared/i18n";
import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { and, desc, eq } from "drizzle-orm";

import { PlaceAddressFields } from "~/components/address/place-address-fields";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { db } from "~/server/db";
import {
  cities,
  cityAreas,
  organizations,
  places,
  placeTranslations,
} from "~/server/db/schema";
import { createPlace } from "./actions";

export default async function PlacesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "dashboard-places");
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
    <>
      <PageHeader
        title={messages["places.title"]}
        sub={messages["places.description"]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card
          title={formatMessage(messages["places.all"], {
            count: String(rows.length),
          })}
        >
          {rows.length === 0 ? (
            <EmptyState>{messages["places.empty"]}</EmptyState>
          ) : (
            <ul className="divide-line divide-y">
              {rows.map((place) => (
                <li
                  key={place.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {place.name ?? messages["places.noName"]}
                    </p>
                    <p className="text-copy-muted text-xs">
                      {[place.org, place.areaCode, place.addressLine]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <Chip tone={place.precision === "exact" ? "ok" : "warn"}>
                    {precisionLabel[place.precision]}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={messages["places.new"]}>
          <form action={createPlace} className="grid gap-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="cityId" value={calais.id} />
            <Field label={messages["places.nameFr"]}>
              <TextInput name="nameFr" required minLength={2} />
            </Field>
            <Field
              label={messages["places.nameEn"]}
              hint={messages["places.optional"]}
            >
              <TextInput name="nameEn" />
            </Field>
            <Field
              label={messages["places.nameAr"]}
              hint={messages["places.optional"]}
            >
              <TextInput name="nameAr" dir="rtl" />
            </Field>
            <Field
              label={messages["places.organization"]}
              hint={messages["places.organizationHint"]}
            >
              <Select name="organizationId" defaultValue="">
                <option value="">—</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={messages["places.cityArea"]}
              hint={messages["places.cityAreaHint"]}
            >
              <Select name="cityAreaId" defaultValue="">
                <option value="">—</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.code}
                  </option>
                ))}
              </Select>
            </Field>
            <PlaceAddressFields
              labels={{
                label: messages["places.address.label"],
                placeholder: messages["places.address.placeholder"],
                help: messages["places.address.help"],
                loading: messages["places.address.loading"],
                empty: messages["places.address.empty"],
                error: messages["places.address.error"],
                attribution: messages["places.address.attribution"],
              }}
              selectedLabel={messages["places.address.selected"]}
            />
            <Field
              label={messages["places.precision"]}
              hint={messages["places.precisionHint"]}
            >
              <Select name="precision" defaultValue="exact">
                <option value="exact">
                  {messages["places.precision.exact"]}
                </option>
                <option value="area_only">
                  {messages["places.precision.areaOnly"]}
                </option>
                <option value="contact_to_learn">
                  {messages["places.precision.contact"]}
                </option>
              </Select>
            </Field>
            <Button>{messages["places.create"]}</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
