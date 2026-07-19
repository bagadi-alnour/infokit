import { and, desc, eq } from "drizzle-orm";

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "~/components/ui";
import { db } from "~/server/db";
import {
  cities,
  cityAreas,
  organizations,
  places,
  placeTranslations,
} from "~/server/db/schema";
import { createPlace } from "./actions";

const precisionLabel = {
  exact: "Exact location",
  area_only: "Area only",
  contact_to_learn: "Contact to learn",
} as const;

export default async function PlacesPage() {
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
        title="Places"
        sub="“How precisely may this be published?” is the organisation's choice (RISKS.md R5)."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title={`All places (${String(rows.length)})`}>
          {rows.length === 0 ? (
            <EmptyState>No places yet.</EmptyState>
          ) : (
            <ul className="divide-line divide-y">
              {rows.map((place) => (
                <li
                  key={place.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {place.name ?? "(no name)"}
                    </p>
                    <p className="text-muted text-xs">
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
        <Card title="New place">
          <form action={createPlace} className="grid gap-3">
            <input type="hidden" name="cityId" value={calais.id} />
            <Field label="Name (français)">
              <TextInput name="nameFr" required minLength={2} />
            </Field>
            <Field label="Name (English)" hint="Optional">
              <TextInput name="nameEn" />
            </Field>
            <Field label="Name (العربية)" hint="Optional">
              <TextInput name="nameAr" dir="rtl" />
            </Field>
            <Field
              label="Organisation"
              hint="Optional — platform place if empty"
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
              label="City area"
              hint="Used by the simulator location question"
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
            <Field label="Address">
              <TextInput name="addressLine" />
            </Field>
            <Field label="Postal code">
              <TextInput name="postalCode" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <TextInput name="lat" inputMode="decimal" />
              </Field>
              <Field label="Longitude">
                <TextInput name="lng" inputMode="decimal" />
              </Field>
            </div>
            <Field
              label="Publication precision"
              hint="What must never be published, and at what precision?"
            >
              <Select name="precision" defaultValue="exact">
                <option value="exact">exact location</option>
                <option value="area_only">area only</option>
                <option value="contact_to_learn">contact to learn</option>
              </Select>
            </Field>
            <Button>Create place</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
