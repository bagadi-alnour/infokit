import {
  boolean,
  doublePrecision,
  index,
  primaryKey,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { cities, cityAreas, languages } from "./catalog";
import { organizations } from "./organizations";
import {
  content,
  locationPrecision,
  timestamps,
  translationState,
} from "./schemas";

/**
 * Physical places. `precision` is the RISKS.md R5 decision made data:
 * the providing organisation chooses how precisely a place may be
 * published — exact point, area only, or contact-to-learn.
 */
export const places = content.table(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id),
    cityAreaId: uuid("city_area_id").references(() => cityAreas.id),
    addressLine: varchar("address_line", { length: 255 }),
    postalCode: varchar("postal_code", { length: 20 }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    precision: locationPrecision("precision").notNull().default("exact"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("places_city_idx").on(t.cityId)],
);

export const placeTranslations = content.table(
  "place_translations",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    name: varchar("name", { length: 150 }).notNull(),
    directionsHint: text("directions_hint"),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.languageCode] })],
);
