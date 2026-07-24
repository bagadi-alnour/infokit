/* eslint-disable no-console -- CLI seed script reports progress to stdout */
import "dotenv/config";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { hashPassword } from "../auth/password";
import { catalogueScopeKey } from "../content/catalogue-scope";
import {
  GLOBAL_SERVICES,
  GLOBAL_TAGS,
  PUBLIC_AUDIENCES,
  PUBLIC_SERVICE_CATEGORIES,
  publicLanguageCodes,
  SPECIALITIES,
} from "./seed-public-catalog";
import * as s from "./schema";

/**
 * Catalogue seeds — idempotent upserts keyed on `code` (ENGINEERING-NOTES §4).
 * Catalogues are data: adding a city or language later is an insert, never a
 * migration. The Slice 0 discovery organisations below are the one exception:
 * they contain only sourced public identity/profile facts, remain draft and
 * unpublished, and receive a pending verification record. Places, activities,
 * services, editorial content, and users are never seeded with real claims.
 * Demo fixtures must carry the "Demo data — do not publish" label (AGENTS.md).
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const client = postgres(url, { max: 1 });
const db = drizzle(client);

const LOCALES = ["en", "fr", "ar"] as const;
type Tri = Record<(typeof LOCALES)[number], string>;

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Seed integrity: missing ${what}`);
  return value;
}

/* ----------------------------- languages ----------------------------- */

const LANGUAGES: {
  code: string;
  nativeName: string;
  englishName: string;
  frenchName: string;
  direction: "ltr" | "rtl";
  enabled: boolean;
  fallbackCode: string | null;
  publicSortOrder: number;
}[] = [
  // fr first: it is the fallback target for every other language.
  {
    code: "fr",
    nativeName: "Français",
    englishName: "French",
    frenchName: "Français",
    direction: "ltr",
    enabled: true,
    fallbackCode: null,
    publicSortOrder: 1,
  },
  {
    code: "en",
    nativeName: "English",
    englishName: "English",
    frenchName: "Anglais",
    direction: "ltr",
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 2,
  },
  {
    code: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
    frenchName: "Arabe",
    direction: "rtl",
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 3,
  },
  // Supported public-information languages for Calais. Present but disabled:
  // a language ships only when a named person owns its review (PRODUCT.md §17).
  // Enabling is then a single flag flip.
  {
    code: "fa",
    nativeName: "فارسی",
    englishName: "Persian (Farsi)",
    frenchName: "Persan (farsi)",
    direction: "rtl",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 4,
  },
  {
    code: "prs",
    nativeName: "دری",
    englishName: "Dari",
    frenchName: "Dari",
    direction: "rtl",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 5,
  },
  {
    code: "ps",
    nativeName: "پښتو",
    englishName: "Pashto",
    frenchName: "Pachto",
    direction: "rtl",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 6,
  },
  {
    // Central Kurdish (Sorani); if Kurmanji is meant instead, use `kmr` (ltr).
    code: "ckb",
    nativeName: "کوردیی ناوەندی",
    englishName: "Kurdish (Sorani)",
    frenchName: "Kurde (sorani)",
    direction: "rtl",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 7,
  },
  {
    code: "ti",
    nativeName: "ትግርኛ",
    englishName: "Tigrinya",
    frenchName: "Tigrigna",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 8,
  },
  {
    code: "am",
    nativeName: "አማርኛ",
    englishName: "Amharic",
    frenchName: "Amharique",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 9,
  },
  {
    code: "om",
    nativeName: "Afaan Oromoo",
    englishName: "Oromo",
    frenchName: "Oromo",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 10,
  },
  {
    code: "so",
    nativeName: "Soomaali",
    englishName: "Somali",
    frenchName: "Somali",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 11,
  },
];

async function seedLanguages() {
  for (const row of LANGUAGES) {
    await db
      .insert(s.languages)
      .values(row)
      .onConflictDoUpdate({ target: s.languages.code, set: row });
  }
  console.log(`languages: ${String(LANGUAGES.length)}`);
}

/* ------------------------------- cities ------------------------------ */

const CITY_AREAS: { code: string; displayOrder: number; label: Tri }[] = [
  {
    code: "centre",
    displayOrder: 1,
    label: { en: "Calais centre", fr: "Centre de Calais", ar: "وسط كاليه" },
  },
  {
    code: "west",
    displayOrder: 2,
    label: { en: "West Calais", fr: "Calais ouest", ar: "غرب كاليه" },
  },
  {
    code: "east",
    displayOrder: 3,
    label: { en: "East Calais", fr: "Calais est", ar: "شرق كاليه" },
  },
  {
    code: "station",
    displayOrder: 4,
    label: {
      en: "Near Calais-Ville station",
      fr: "Près de la gare Calais-Ville",
      ar: "قرب محطة كاليه-فيل",
    },
  },
];

async function seedCalais() {
  const cityValues = { code: "calais", timezone: "Europe/Paris", active: true };
  const [city] = await db
    .insert(s.cities)
    .values(cityValues)
    .onConflictDoUpdate({ target: s.cities.code, set: cityValues })
    .returning({ id: s.cities.id });
  const cityId = must(city, "calais city row").id;

  const cityNames: Tri = { en: "Calais", fr: "Calais", ar: "كاليه" };
  for (const locale of LOCALES) {
    await db
      .insert(s.cityTranslations)
      .values({ cityId, languageCode: locale, name: cityNames[locale] })
      .onConflictDoUpdate({
        target: [s.cityTranslations.cityId, s.cityTranslations.languageCode],
        set: { name: cityNames[locale] },
      });
  }

  for (const area of CITY_AREAS) {
    const areaValues = {
      cityId,
      code: area.code,
      displayOrder: area.displayOrder,
      active: true,
    };
    const [inserted] = await db
      .insert(s.cityAreas)
      .values(areaValues)
      .onConflictDoUpdate({
        target: [s.cityAreas.cityId, s.cityAreas.code],
        set: areaValues,
      })
      .returning({ id: s.cityAreas.id });
    const areaId = must(inserted, `area ${area.code}`).id;
    for (const locale of LOCALES) {
      await db
        .insert(s.cityAreaTranslations)
        .values({
          cityAreaId: areaId,
          languageCode: locale,
          label: area.label[locale],
        })
        .onConflictDoUpdate({
          target: [
            s.cityAreaTranslations.cityAreaId,
            s.cityAreaTranslations.languageCode,
          ],
          set: { label: area.label[locale] },
        });
    }
  }
  console.log(`cities: 1 (calais, ${String(CITY_AREAS.length)} areas)`);
}

/* ------------------- private discovery organisations ---------------- */

const DISCOVERY_SOURCE_CHECKED_ON = "2026-07-21";

const DISCOVERY_ORGANIZATIONS: {
  slug: string;
  displayName: string;
  foundedYear: number;
  website: string;
  sourceUrl: string;
  languageCode: "en" | "fr";
  purpose: string;
  goals: string;
  values: string | null;
}[] = [
  {
    slug: "auberge-des-migrants",
    displayName: "L’Auberge des Migrants",
    foundedYear: 2008,
    website: "https://laubergedesmigrants.fr/",
    sourceUrl: "https://laubergedesmigrants.fr/fr/lauberge-des-migrants/about/",
    languageCode: "fr",
    purpose:
      "Apporter une aide matérielle d’urgence aux personnes en exil dans la région de Calais.",
    goals:
      "Répondre aux besoins matériels sur le terrain et promouvoir la dignité des personnes déplacées.",
    values: "Dignité, solidarité et indépendance de l’action humanitaire.",
  },
  {
    slug: "utopia-56",
    displayName: "Utopia 56",
    foundedYear: 2015,
    website: "https://utopia56.org/",
    sourceUrl: "https://utopia56.org/calais/",
    languageCode: "fr",
    purpose:
      "Venir en aide aux personnes exilées et à toute personne en détresse dans le respect de leurs choix.",
    goals:
      "Fournir une aide d’urgence, orienter vers les dispositifs adaptés, documenter les atteintes aux droits et faciliter la mise à l’abri.",
    values:
      "Respect sans discrimination, fraternité, dignité et défense des droits fondamentaux.",
  },
  {
    slug: "secours-catholique-caritas-france",
    displayName: "Secours Catholique–Caritas France",
    foundedYear: 1946,
    website: "https://pasdecalais.secours-catholique.org/",
    sourceUrl:
      "https://pasdecalais.secours-catholique.org/qui-sommes-nous/presentation/nos-actions",
    languageCode: "fr",
    purpose:
      "Agir avec les personnes en situation de précarité et soutenir les personnes exilées présentes dans le Calaisis.",
    goals:
      "Répondre aux besoins urgents, défendre les droits, faciliter l’accès à l’information, à l’accompagnement et à l’hébergement, et renforcer le pouvoir d’agir.",
    values: "Fraternité, dignité, solidarité, rencontre et participation.",
  },
  {
    slug: "care4calais",
    displayName: "Care4Calais",
    foundedYear: 2016,
    website: "https://care4calais.org/",
    sourceUrl: "https://care4calais.org/about-us/who-we-are/",
    languageCode: "en",
    purpose:
      "Deliver essential aid and support to refugees living in northern France and the United Kingdom.",
    goals:
      "Provide clothing, shelter and daily essentials, offer social support, and advocate for a welcoming and inclusive response to people seeking safety.",
    values: "Dignity, fairness, inclusion, welcome, and practical solidarity.",
  },
  {
    slug: "calais-food-collective",
    displayName: "Calais Food Collective",
    foundedYear: 2020,
    website: "https://www.calaisfoodcollective.org/",
    sourceUrl: "https://www.calaisfoodcollective.org/",
    languageCode: "en",
    purpose:
      "Support people on the move in Calais by advocating for food and water autonomy.",
    goals:
      "Provide food and water, improve sanitation around living sites, and advocate for accessible water and waste services.",
    values: "Grassroots solidarity, autonomy, dignity, and free movement.",
  },
  {
    slug: "project-play",
    displayName: "Project Play",
    foundedYear: 2018,
    website: "https://www.project-play.org/",
    sourceUrl: "https://www.project-play.org/about-us",
    languageCode: "en",
    purpose:
      "Provide safe spaces and play for displaced children and young people in northern France.",
    goals:
      "Support children’s overall well-being through regular play sessions in safe and welcoming environments.",
    values: "Safety, inclusion, play, care, and child-centred support.",
  },
  {
    slug: "refugee-womens-centre",
    displayName: "Refugee Women’s Centre",
    foundedYear: 2017,
    website: "https://refugeewomenscentre.com/",
    sourceUrl: "https://refugeewomenscentre.com/about/",
    languageCode: "en",
    purpose:
      "Provide holistic support for displaced women and families living without shelter in northern France.",
    goals:
      "Create safer spaces, provide individual material and psychosocial support, connect people with specialist services, and advocate for shelter and fundamental rights.",
    values:
      "Respect, solidarity, anti-oppressive practice, intersectional feminism, and collaboration.",
  },
  {
    slug: "refugee-community-kitchen",
    displayName: "Refugee Community Kitchen",
    foundedYear: 2015,
    website: "https://refugeecommunitykitchen.org/",
    sourceUrl: "https://refugeecommunitykitchen.org/news/ten-years-of-rck",
    languageCode: "en",
    purpose:
      "Prepare and serve warm, nutritious food to displaced people and other communities in need.",
    goals:
      "Offer dependable food support in Calais while making meals that respect the people and cultures served.",
    values:
      "Food without judgment, dignity, cultural identity, community, and solidarity.",
  },
];

async function seedDiscoveryOrganizations() {
  let created = 0;
  for (const row of DISCOVERY_ORGANIZATIONS) {
    const [inserted] = await db
      .insert(s.organizations)
      .values({
        slug: row.slug,
        displayName: row.displayName,
        foundedYear: row.foundedYear,
        status: "draft",
      })
      .onConflictDoNothing({ target: s.organizations.slug })
      .returning({ id: s.organizations.id, status: s.organizations.status });
    const existing = inserted
      ? undefined
      : (
          await db
            .select({ id: s.organizations.id, status: s.organizations.status })
            .from(s.organizations)
            .where(eq(s.organizations.slug, row.slug))
            .limit(1)
        )[0];
    const organization = must(
      inserted ?? existing,
      `discovery organisation ${row.slug}`,
    );
    if (inserted) created += 1;

    await db
      .insert(s.organizationProfiles)
      .values({
        organizationId: organization.id,
        website: row.website,
        sourceUrl: row.sourceUrl,
        sourceCheckedOn: DISCOVERY_SOURCE_CHECKED_ON,
        published: false,
      })
      .onConflictDoNothing({ target: s.organizationProfiles.organizationId });

    await db
      .insert(s.organizationProfileTranslations)
      .values({
        organizationId: organization.id,
        languageCode: row.languageCode,
        purpose: row.purpose,
        goals: row.goals,
        values: row.values,
        state: "draft",
        method: "human",
      })
      .onConflictDoNothing({
        target: [
          s.organizationProfileTranslations.organizationId,
          s.organizationProfileTranslations.languageCode,
        ],
      });

    if (organization.status === "draft") {
      const [pendingVerification] = await db
        .select({ id: s.organizationVerifications.id })
        .from(s.organizationVerifications)
        .where(
          and(
            eq(s.organizationVerifications.organizationId, organization.id),
            eq(s.organizationVerifications.status, "pending"),
          ),
        )
        .limit(1);
      if (!pendingVerification) {
        await db.insert(s.organizationVerifications).values({
          organizationId: organization.id,
          method: "official_public_source",
          status: "pending",
          notes:
            "Discovery seed only; organisation confirmation is required before publication.",
        });
      }
    }
  }
  console.log(
    `discovery organisations: ${String(DISCOVERY_ORGANIZATIONS.length)} (${String(created)} new, all unpublished)`,
  );
}

/* --------------------------- service categories ---------------------- */

async function seedCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [displayOrder, cat] of PUBLIC_SERVICE_CATEGORIES.entries()) {
    const values = {
      code: cat.code,
      icon: cat.icon,
      colorToken: cat.code, // resolved against @calais/tokens categoryAccents
      enabled: true,
      displayOrder: displayOrder + 1,
    };
    const [row] = await db
      .insert(s.serviceCategories)
      .values(values)
      .onConflictDoUpdate({ target: s.serviceCategories.code, set: values })
      .returning({ id: s.serviceCategories.id });
    const id = must(row, `category ${cat.code}`).id;
    ids.set(cat.code, id);
    for (const locale of publicLanguageCodes) {
      await db
        .insert(s.serviceCategoryTranslations)
        .values({
          categoryId: id,
          languageCode: locale,
          label: cat.label[locale],
        })
        .onConflictDoUpdate({
          target: [
            s.serviceCategoryTranslations.categoryId,
            s.serviceCategoryTranslations.languageCode,
          ],
          set: { label: cat.label[locale] },
        });
    }
  }
  await db
    .update(s.serviceCategories)
    .set({ enabled: false })
    .where(
      notInArray(
        s.serviceCategories.code,
        PUBLIC_SERVICE_CATEGORIES.map((category) => category.code),
      ),
    );
  console.log(
    `service categories: ${String(PUBLIC_SERVICE_CATEGORIES.length)}`,
  );
  return ids;
}

/* --------------------------- audience categories --------------------- */

async function seedAudiences() {
  for (const [displayOrder, aud] of PUBLIC_AUDIENCES.entries()) {
    const values = {
      code: aud.code,
      icon: "users",
      enabled: true,
      displayOrder: displayOrder + 1,
    };
    const [row] = await db
      .insert(s.audienceCategories)
      .values(values)
      .onConflictDoUpdate({ target: s.audienceCategories.code, set: values })
      .returning({ id: s.audienceCategories.id });
    const id = must(row, `audience ${aud.code}`).id;
    for (const locale of publicLanguageCodes) {
      await db
        .insert(s.audienceCategoryTranslations)
        .values({
          audienceCategoryId: id,
          languageCode: locale,
          label: aud.label[locale],
          state: "verified",
        })
        .onConflictDoUpdate({
          target: [
            s.audienceCategoryTranslations.audienceCategoryId,
            s.audienceCategoryTranslations.languageCode,
          ],
          set: { label: aud.label[locale] },
        });
    }
  }
  console.log(`audience categories: ${String(PUBLIC_AUDIENCES.length)}`);
}

/* ---------------------- global services and tags -------------------- */

async function seedGlobalServices(categoryIds: Map<string, string>) {
  for (const service of GLOBAL_SERVICES) {
    const values = {
      organizationId: null,
      code: service.code,
      icon: service.icon,
      categoryId: must(
        categoryIds.get(service.category),
        `category ${service.category}`,
      ),
      active: true,
      archivedAt: null,
      sourceNote: "Platform catalogue",
    };
    const [existing] = await db
      .select({ id: s.services.id })
      .from(s.services)
      .where(
        and(
          isNull(s.services.organizationId),
          eq(s.services.code, service.code),
        ),
      )
      .limit(1);
    const row = existing
      ? (
          await db
            .update(s.services)
            .set(values)
            .where(eq(s.services.id, existing.id))
            .returning({ id: s.services.id })
        )[0]
      : (
          await db
            .insert(s.services)
            .values(values)
            .returning({ id: s.services.id })
        )[0];
    const serviceId = must(row, `global service ${service.code}`).id;
    for (const languageCode of publicLanguageCodes) {
      await db
        .insert(s.serviceTranslations)
        .values({
          serviceId,
          scopeKey: catalogueScopeKey(null),
          languageCode,
          name: service.label[languageCode],
          state: "verified",
          method: "human",
        })
        .onConflictDoUpdate({
          target: [
            s.serviceTranslations.serviceId,
            s.serviceTranslations.languageCode,
          ],
          set: {
            scopeKey: catalogueScopeKey(null),
            name: service.label[languageCode],
            state: "verified",
            method: "human",
          },
        });
    }
  }
  console.log(`global services: ${String(GLOBAL_SERVICES.length)}`);
}

async function seedGlobalTags() {
  for (const [displayOrder, tag] of GLOBAL_TAGS.entries()) {
    const [existing] = await db
      .select({ id: s.tags.id })
      .from(s.tags)
      .where(
        and(
          isNull(s.tags.organizationId),
          eq(s.tags.namespace, "access"),
          eq(s.tags.code, tag.code),
        ),
      )
      .limit(1);
    const values = {
      organizationId: null,
      namespace: "access",
      code: tag.code,
      colorToken: "neutral",
      visibility: "public" as const,
      displayOrder: displayOrder + 1,
      active: true,
    };
    const row = existing
      ? (
          await db
            .update(s.tags)
            .set(values)
            .where(eq(s.tags.id, existing.id))
            .returning({ id: s.tags.id })
        )[0]
      : (
          await db.insert(s.tags).values(values).returning({ id: s.tags.id })
        )[0];
    const tagId = must(row, `global tag ${tag.code}`).id;
    for (const languageCode of publicLanguageCodes) {
      await db
        .insert(s.tagTranslations)
        .values({
          tagId,
          scopeKey: catalogueScopeKey(null),
          languageCode,
          label: tag.label[languageCode],
        })
        .onConflictDoUpdate({
          target: [s.tagTranslations.tagId, s.tagTranslations.languageCode],
          set: {
            scopeKey: catalogueScopeKey(null),
            label: tag.label[languageCode],
          },
        });
    }
  }
  console.log(`global tags: ${String(GLOBAL_TAGS.length)}`);
}

/* ------------------------------ specialities ------------------------- */

async function seedSpecialities() {
  for (const spec of SPECIALITIES) {
    const values = {
      code: spec.code,
      icon: spec.icon,
      enabled: true,
      displayOrder: spec.displayOrder,
    };
    const [row] = await db
      .insert(s.specialities)
      .values(values)
      .onConflictDoUpdate({ target: s.specialities.code, set: values })
      .returning({ id: s.specialities.id });
    const id = must(row, `speciality ${spec.code}`).id;
    for (const locale of publicLanguageCodes) {
      await db
        .insert(s.specialityTranslations)
        .values({
          specialityId: id,
          languageCode: locale,
          label: spec.label[locale],
        })
        .onConflictDoUpdate({
          target: [
            s.specialityTranslations.specialityId,
            s.specialityTranslations.languageCode,
          ],
          set: { label: spec.label[locale] },
        });
    }
  }
  console.log(`specialities: ${String(SPECIALITIES.length)}`);
}

/* ----------------------------- search concepts ----------------------- */

/** Field-confirmed launch service types (PRODUCT.md §23, 17–18 July 2026). */
const CONCEPTS: { code: string; category: string; label: Tri }[] = [
  {
    code: "breakfast",
    category: "food",
    label: { en: "Breakfast", fr: "Petit-déjeuner", ar: "فطور" },
  },
  {
    code: "lunch",
    category: "food",
    label: { en: "Lunch", fr: "Repas de midi", ar: "غداء" },
  },
  {
    code: "dinner",
    category: "food",
    label: { en: "Evening meal", fr: "Repas du soir", ar: "عشاء" },
  },
  {
    code: "tea_coffee",
    category: "food",
    label: { en: "Tea & coffee", fr: "Thé & café", ar: "شاي وقهوة" },
  },
  {
    code: "drinking_water",
    category: "water",
    label: { en: "Drinking water", fr: "Eau potable", ar: "ماء الشرب" },
  },
  {
    code: "shower",
    category: "showers",
    label: { en: "Shower", fr: "Douche", ar: "استحمام" },
  },
  {
    code: "laundry",
    category: "showers",
    label: { en: "Laundry", fr: "Laverie", ar: "غسيل الملابس" },
  },
  {
    code: "clothes",
    category: "clothing",
    label: { en: "Clothes", fr: "Vêtements", ar: "ملابس" },
  },
  {
    code: "shoes",
    category: "clothing",
    label: { en: "Shoes", fr: "Chaussures", ar: "أحذية" },
  },
  {
    code: "tents",
    category: "material",
    label: { en: "Tent", fr: "Tente", ar: "خيمة" },
  },
  {
    code: "sleeping_bags",
    category: "material",
    label: { en: "Sleeping bag", fr: "Sac de couchage", ar: "كيس نوم" },
  },
  {
    code: "asylum_information",
    category: "legal",
    label: {
      en: "Asylum information",
      fr: "Information asile",
      ar: "معلومات اللجوء",
    },
  },
  {
    code: "games",
    category: "activities",
    label: { en: "Games", fr: "Jeux", ar: "ألعاب" },
  },
  {
    code: "outdoors",
    category: "activities",
    label: {
      en: "Outdoor sport",
      fr: "Sport extérieur",
      ar: "رياضة في الهواء الطلق",
    },
  },
  {
    code: "artistic_activity",
    category: "activities",
    label: { en: "Art workshop", fr: "Atelier artistique", ar: "ورشة فنية" },
  },
  {
    code: "sim_card",
    category: "charging",
    label: { en: "SIM card", fr: "Carte SIM", ar: "شريحة SIM" },
  },
  {
    code: "calling_family",
    category: "charging",
    label: {
      en: "Calling your family",
      fr: "Appeler votre famille",
      ar: "الاتصال بعائلتك",
    },
  },
  {
    code: "device_charging",
    category: "charging",
    label: { en: "Phone charging", fr: "Recharge téléphone", ar: "شحن الهاتف" },
  },
];

const CONCEPT_CATEGORY = {
  food: "essentials",
  water: "essentials",
  showers: "hygiene_material",
  clothing: "hygiene_material",
  material: "hygiene_material",
  legal: "legal_orientation",
  activities: "community",
  charging: "connectivity",
} as const;

async function seedConcepts(categoryIds: Map<string, string>) {
  for (const concept of CONCEPTS) {
    const values = {
      code: concept.code,
      categoryId: must(
        categoryIds.get(
          CONCEPT_CATEGORY[concept.category as keyof typeof CONCEPT_CATEGORY],
        ),
        `category for concept ${concept.category}`,
      ),
      enabled: true,
    };
    const [row] = await db
      .insert(s.searchConcepts)
      .values(values)
      .onConflictDoUpdate({ target: s.searchConcepts.code, set: values })
      .returning({ id: s.searchConcepts.id });
    const id = must(row, `concept ${concept.code}`).id;
    for (const locale of LOCALES) {
      await db
        .insert(s.searchConceptTranslations)
        .values({
          conceptId: id,
          languageCode: locale,
          label: concept.label[locale],
        })
        .onConflictDoUpdate({
          target: [
            s.searchConceptTranslations.conceptId,
            s.searchConceptTranslations.languageCode,
          ],
          set: { label: concept.label[locale] },
        });
    }
  }
  console.log(`search concepts: ${String(CONCEPTS.length)}`);
}

/* --------------------------- roles & permissions ---------------------- */

const PERMISSIONS: { code: string; description: string }[] = [
  {
    code: "support.superadmin",
    description:
      "Perform audited platform support actions, including organisation and role context switching",
  },
  {
    code: "organization.verify",
    description:
      "Review, verify, reject, suspend, or reactivate participating organisations",
  },
  {
    code: "taxonomy.manage",
    description:
      "Maintain shared platform taxonomies, categories, specialities, and search concepts",
  },
  {
    code: "audit.read",
    description: "Read permitted platform or organisation audit history",
  },
  {
    code: "content.article.write",
    description: "Create, edit, and translate owned articles",
  },
  {
    code: "content.article.publish",
    description: "Publish, unpublish, and archive owned articles",
  },
  {
    code: "content.article.review",
    description: "Review and approve submitted article translations",
  },
  {
    code: "content.joint_publication.approve",
    description:
      "Approve an immutable publication revision on behalf of an organisation",
  },
  {
    code: "content.article_custody.transfer",
    description:
      "Initiate or accept an article-custody transfer for an authorised organisation",
  },
  {
    code: "content.activity.manage",
    description:
      "Maintain places, reusable services, activities, schedules, occurrences, and public events",
  },
  {
    code: "content.activity.verify",
    description:
      "Confirm freshness and verify activity, service, schedule, and event information",
  },
  {
    code: "content.simulator.review",
    description:
      "Maintain and review simulator flows, rules, and result content",
  },
  {
    code: "content.translation.request",
    description:
      "Create secure translation assignments for approved public or editorial content",
  },
  {
    code: "content.translation.submit",
    description:
      "Accept assigned translation work and submit translations for review",
  },
  {
    code: "content.translation.review",
    description:
      "Review and accept, reject, or request changes to translator submissions",
  },
  {
    code: "organization.profile.manage",
    description:
      "Maintain the organisation's public profile, contacts, and approved presentation information",
  },
  {
    code: "members.read",
    description:
      "Read the organisation's permitted member list and membership details",
  },
  {
    code: "members.manage",
    description:
      "Invite, activate, update, deactivate, and revoke organisation memberships",
  },
  {
    code: "roles.manage",
    description:
      "Assign and revoke organisation-scoped roles and maintain permitted organisation role templates",
  },
  {
    code: "teams.manage",
    description:
      "Manage organisation teams, team membership, and operational assignments",
  },
  {
    code: "planning.manage",
    description:
      "Manage internal availability, shifts, missions, meetings, and planning workflows",
  },
  {
    code: "coordination.event.manage",
    description:
      "Create and manage authorised inter-organisation coordination events",
  },
  {
    code: "documents.prepare",
    description:
      "Prepare approved participation documents from authorised templates",
  },
  {
    code: "documents.send",
    description:
      "Create signing workflows and send documents to authorised participants",
  },
  {
    code: "documents.sign_assigned",
    description:
      "View and sign documents explicitly assigned to the current member",
  },
  {
    code: "documents.read_all",
    description:
      "Read restricted organisation documents beyond those assigned to the current member",
  },
  {
    code: "documents.audit",
    description: "Read document workflow, signature, and access audit history",
  },
  {
    code: "inventory.read",
    description:
      "Read permitted inventory locations, catalogues, balances, alerts, and movements",
  },
  {
    code: "inventory.locations.manage",
    description:
      "Create and maintain organisation storage locations and their operational configuration",
  },
  {
    code: "inventory.catalog.manage",
    description:
      "Maintain item categories, items, variants, units, and tracking policies",
  },
  {
    code: "inventory.move",
    description:
      "Post authorised receipts, adjustments, reservations, releases, transfers, kit operations, and distributions",
  },
  {
    code: "inventory.transfer.approve",
    description:
      "Accept or decline inventory transfers for the destination organisation",
  },
  {
    code: "inventory.financial.read",
    description: "Read restricted inventory cost and replacement-value fields",
  },
  {
    code: "inventory.audit.read",
    description: "Read inventory movement and reconciliation audit history",
  },
];

/**
 * Platform-defined role templates (`organizationId` null). Permissions are
 * deliberately atomic: broader roles receive every capability explicitly,
 * and one organisation member may hold more than one role.
 */
const ROLES: { code: string; description: string; permissions: string[] }[] = [
  {
    code: "platform_superadmin",
    description:
      "Performs audited platform support and organisation-context switching",
    permissions: ["support.superadmin", "audit.read"],
  },
  {
    code: "platform_operator",
    description:
      "Verifies organisations, maintains taxonomies, investigates audit events",
    permissions: ["organization.verify", "taxonomy.manage", "audit.read"],
  },
  {
    code: "platform_editor",
    description:
      "Maintains platform public content and proxy-publishes with recorded approval",
    permissions: [
      "content.article.write",
      "content.article.publish",
      "content.activity.manage",
      "content.activity.verify",
      "content.simulator.review",
      "content.translation.request",
      "content.translation.review",
    ],
  },
  {
    code: "organization_author",
    description: "Creates and translates articles owned by their organisation",
    permissions: ["content.article.write"],
  },
  {
    code: "organization_publisher",
    description: "Creates and publishes articles owned by their organisation",
    permissions: ["content.article.write", "content.article.publish"],
  },
  {
    code: "organization_verifier",
    description:
      "Confirms freshness and verifies public operational information",
    permissions: ["content.activity.verify"],
  },
  {
    code: "translation_reviewer",
    description:
      "Reviews translation assignments and submitted article translations",
    permissions: ["content.translation.review", "content.article.review"],
  },
  {
    code: "organization_admin",
    description:
      "Maintains an organisation profile, memberships, roles, and audit access",
    permissions: [
      "organization.profile.manage",
      "members.read",
      "members.manage",
      "roles.manage",
      "audit.read",
    ],
  },
  {
    code: "organization_editor",
    description: "Maintains an organisation's public information and articles",
    permissions: [
      "content.activity.manage",
      "content.article.write",
      "content.article.publish",
      "content.translation.request",
    ],
  },
  {
    code: "organization_translator",
    description: "Completes assigned translation work",
    permissions: ["content.translation.submit"],
  },
  {
    code: "coordinator",
    description:
      "Coordinates organisation teams, planning, and shared coordination events",
    permissions: [
      "members.read",
      "teams.manage",
      "planning.manage",
      "coordination.event.manage",
    ],
  },
  {
    code: "team_lead",
    description: "Manages organisation teams and internal planning",
    permissions: ["members.read", "teams.manage", "planning.manage"],
  },
  {
    code: "document_signatory",
    description: "Views and signs documents explicitly assigned to them",
    permissions: ["documents.sign_assigned"],
  },
  {
    code: "inventory_manager",
    description:
      "Maintains inventory locations, catalogues, movements, and inventory audit",
    permissions: [
      "inventory.read",
      "inventory.locations.manage",
      "inventory.catalog.manage",
      "inventory.move",
      "inventory.audit.read",
    ],
  },
  {
    code: "inventory_finance",
    description: "Reads inventory records and restricted financial fields",
    permissions: ["inventory.read", "inventory.financial.read"],
  },
];

const LEGACY_PERMISSION_RENAMES = [
  ["content.article.create", "content.article.write"],
  ["content.service.manage", "content.activity.manage"],
] as const;

async function seedRoles() {
  const permissionCodes = new Set(
    PERMISSIONS.map((permission) => permission.code),
  );
  for (const role of ROLES) {
    for (const permissionCode of role.permissions) {
      if (!permissionCodes.has(permissionCode)) {
        throw new Error(
          `Seed integrity: role ${role.code} references unknown permission ${permissionCode}`,
        );
      }
    }
  }

  await db.transaction(async (tx) => {
    for (const perm of PERMISSIONS) {
      await tx
        .insert(s.permissions)
        .values(perm)
        .onConflictDoUpdate({ target: s.permissions.code, set: perm });
    }

    // Preserve grants on organisation-defined roles while retiring the two
    // permission names superseded by the approved catalogue.
    for (const [legacyCode, replacementCode] of LEGACY_PERMISSION_RENAMES) {
      const [legacyPermission] = await tx
        .select({ code: s.permissions.code })
        .from(s.permissions)
        .where(eq(s.permissions.code, legacyCode));
      if (legacyPermission === undefined) continue;

      const legacyGrants = await tx
        .select({ roleId: s.rolePermissions.roleId })
        .from(s.rolePermissions)
        .where(eq(s.rolePermissions.permissionCode, legacyCode));
      for (const grant of legacyGrants) {
        await tx
          .insert(s.rolePermissions)
          .values({ roleId: grant.roleId, permissionCode: replacementCode })
          .onConflictDoNothing();
      }
      await tx
        .delete(s.rolePermissions)
        .where(eq(s.rolePermissions.permissionCode, legacyCode));
      await tx.delete(s.permissions).where(eq(s.permissions.code, legacyCode));
    }

    const existing = await tx
      .select({
        id: s.roles.id,
        code: s.roles.code,
        organizationId: s.roles.organizationId,
      })
      .from(s.roles);
    const platformRoles = new Map(
      existing
        .filter((r) => r.organizationId === null)
        .map((r) => [r.code, r.id]),
    );
    for (const role of ROLES) {
      let roleId = platformRoles.get(role.code);
      if (roleId === undefined) {
        const [row] = await tx
          .insert(s.roles)
          .values({ code: role.code, description: role.description })
          .returning({ id: s.roles.id });
        roleId = must(row, `role ${role.code}`).id;
      } else {
        await tx
          .update(s.roles)
          .set({ description: role.description })
          .where(eq(s.roles.id, roleId));
      }

      // Platform templates are authoritative catalogue data. Reconcile their
      // grants exactly so removing access here cannot leave a stale grant.
      await tx
        .delete(s.rolePermissions)
        .where(eq(s.rolePermissions.roleId, roleId));
      for (const permissionCode of role.permissions) {
        await tx
          .insert(s.rolePermissions)
          .values({ roleId, permissionCode })
          .onConflictDoNothing();
      }
    }
  });
  console.log(
    `permissions: ${String(PERMISSIONS.length)}, platform roles: ${String(ROLES.length)}`,
  );
}

/**
 * Grants the support role to the account selected by deployment configuration.
 * A clean local database may not have seen its first Auth.js sign-in yet, so
 * the configured bootstrap identity is created when absent. The address still
 * comes only from environment configuration and is never stored in source.
 */
async function seedBootstrapSuperadmin() {
  const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log("bootstrap superadmin: skipped (email not configured)");
    return;
  }

  const [[existingUser], [role]] = await Promise.all([
    db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.email, email))
      .limit(1),
    db
      .select({ id: s.roles.id })
      .from(s.roles)
      .where(
        and(
          eq(s.roles.code, "platform_superadmin"),
          isNull(s.roles.organizationId),
        ),
      )
      .limit(1),
  ]);
  if (!role) throw new Error("platform_superadmin role was not seeded");

  const [createdUser] = existingUser
    ? []
    : await db.insert(s.users).values({ email }).returning({ id: s.users.id });
  const user = existingUser ?? createdUser;
  if (!user)
    throw new Error("Bootstrap superadmin account could not be created");

  await db
    .insert(s.userPlatformRoles)
    .values({ userId: user.id, roleId: role.id, grantedById: user.id })
    .onConflictDoNothing();

  const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
  if (password) {
    if (password.length < 12 || password.length > 128) {
      throw new Error("Bootstrap password must contain 12 to 128 characters");
    }
    await db
      .update(s.users)
      .set({
        passwordHash: await hashPassword(password),
        passwordUpdatedAt: new Date(),
      })
      .where(eq(s.users.id, user.id));
  }
  console.log(
    `bootstrap superadmin: ${existingUser ? "granted" : "account created and granted"}${password ? " and password updated" : ""}`,
  );
}

/* -------------------------------- main -------------------------------- */

async function main() {
  console.log("Seeding catalogues (idempotent)…");
  await seedLanguages();
  await seedCalais();
  await seedDiscoveryOrganizations();
  const categoryIds = await seedCategories();
  await seedAudiences();
  await seedGlobalServices(categoryIds);
  await seedGlobalTags();
  await seedSpecialities();
  await seedConcepts(categoryIds);
  await seedRoles();
  await seedBootstrapSuperadmin();
  console.log("Done.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void client.end();
  });
