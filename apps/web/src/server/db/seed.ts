/* eslint-disable no-console -- CLI seed script reports progress to stdout */
import "dotenv/config";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { hashPassword } from "better-auth/crypto";
import { catalogueScopeKey } from "../content/catalogue-scope";
import { migratorUrl } from "./migrator-url";
import {
  GLOBAL_SERVICES,
  GLOBAL_TAGS,
  PUBLIC_AUDIENCES,
  PUBLIC_SERVICE_CATEGORIES,
  publicLanguageCodes,
  SPECIALITIES,
} from "./seed-public-catalog";
import * as s from "./schema";
import { sslFor } from "./ssl";

/**
 * Catalogue seeds — idempotent upserts keyed on `code` (ENGINEERING-NOTES §4).
 * Catalogues are data: adding a city or language later is an insert, never a
 * migration. The Slice 0 discovery organisations below are the one exception:
 * they contain only sourced public identity/profile facts, remain draft and
 * unpublished, and receive a pending verification record. Places, activities,
 * services, editorial content, and users are never seeded with real claims.
 * Demo fixtures must carry the "Demo data — do not publish" label (AGENTS.md).
 */

// The owner: this writes catalogues the app is not allowed to write, and the
// bootstrap account's grants live in tables `infokit_app` can only read.
//
// TLS by the same rule as every other entry point (`./ssl`), which is not
// optional here: this seed is pointed at production deliberately — it is how the
// bootstrap account comes into existence — and `rds.force_ssl` refuses an
// unencrypted connection. Omitting the option did not fail at connect, which is
// what made it confusing: postgres.js completed a cleartext handshake and RDS
// rejected the first statement with `no pg_hba.conf entry … no encryption`.
const seedUrl = migratorUrl();
const client = postgres(seedUrl, { ssl: sslFor(seedUrl), max: 1 });
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
  // The configured public catalogue is eleven routable, publishable languages.
  // Content still reaches visitors only after its own human verification and
  // per-language publication; `enabled` distinguishes these from the additional
  // spoken-only catalogue below (PRODUCT.md §17).
  {
    code: "fa",
    nativeName: "فارسی",
    englishName: "Persian (Farsi)",
    frenchName: "Persan (farsi)",
    direction: "rtl",
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 4,
  },
  {
    code: "prs",
    nativeName: "دری",
    englishName: "Dari",
    frenchName: "Dari",
    direction: "rtl",
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 5,
  },
  {
    code: "ps",
    nativeName: "پښتو",
    englishName: "Pashto",
    frenchName: "Pachto",
    direction: "rtl",
    enabled: true,
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
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 7,
  },
  {
    code: "ti",
    nativeName: "ትግርኛ",
    englishName: "Tigrinya",
    frenchName: "Tigrigna",
    direction: "ltr",
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 8,
  },
  {
    code: "am",
    nativeName: "አማርኛ",
    englishName: "Amharic",
    frenchName: "Amharique",
    direction: "ltr",
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 9,
  },
  {
    code: "om",
    nativeName: "Afaan Oromoo",
    englishName: "Oromo",
    frenchName: "Oromo",
    direction: "ltr",
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 10,
  },
  {
    code: "so",
    nativeName: "Soomaali",
    englishName: "Somali",
    frenchName: "Somali",
    direction: "ltr",
    enabled: true,
    fallbackCode: "fr",
    publicSortOrder: 11,
  },
  // Spoken only. These are not publication candidates: they are here so a
  // member or a translator can say which languages they welcome people in, and
  // so a mission can require one. `enabled` answers a different question — can
  // the platform publish content in it — and stays false for all of them.
  {
    code: "ru",
    nativeName: "Русский",
    englishName: "Russian",
    frenchName: "Russe",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 20,
  },
  {
    code: "uk",
    nativeName: "Українська",
    englishName: "Ukrainian",
    frenchName: "Ukrainien",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 21,
  },
  {
    code: "tr",
    nativeName: "Türkçe",
    englishName: "Turkish",
    frenchName: "Turc",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 22,
  },
  {
    code: "ku",
    nativeName: "Kurmancî",
    englishName: "Kurdish (Kurmanji)",
    frenchName: "Kurde (kurmandji)",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 23,
  },
  {
    code: "sq",
    nativeName: "Shqip",
    englishName: "Albanian",
    frenchName: "Albanais",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 24,
  },
  {
    code: "ur",
    nativeName: "اردو",
    englishName: "Urdu",
    frenchName: "Ourdou",
    direction: "rtl",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 25,
  },
  {
    code: "bn",
    nativeName: "বাংলা",
    englishName: "Bengali",
    frenchName: "Bengali",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 26,
  },
  {
    code: "vi",
    nativeName: "Tiếng Việt",
    englishName: "Vietnamese",
    frenchName: "Vietnamien",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 27,
  },
  {
    code: "es",
    nativeName: "Español",
    englishName: "Spanish",
    frenchName: "Espagnol",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 28,
  },
  {
    code: "it",
    nativeName: "Italiano",
    englishName: "Italian",
    frenchName: "Italien",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 29,
  },
  {
    code: "pt",
    nativeName: "Português",
    englishName: "Portuguese",
    frenchName: "Portugais",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 30,
  },
  {
    code: "de",
    nativeName: "Deutsch",
    englishName: "German",
    frenchName: "Allemand",
    direction: "ltr",
    enabled: false,
    fallbackCode: "fr",
    publicSortOrder: 31,
  },
];

async function seedLanguages() {
  const configuredCodes = new Set<string>(publicLanguageCodes);
  const enabledCodes = new Set(
    LANGUAGES.filter((language) => language.enabled).map(
      (language) => language.code,
    ),
  );
  const missingPublic = publicLanguageCodes.filter(
    (code) => !enabledCodes.has(code),
  );
  const unexpectedPublic = [...enabledCodes].filter(
    (code) => !configuredCodes.has(code),
  );
  if (missingPublic.length > 0 || unexpectedPublic.length > 0) {
    throw new Error(
      `Seed integrity: enabled languages must match the public catalogue (missing: ${missingPublic.join(", ") || "none"}; unexpected: ${unexpectedPublic.join(", ") || "none"})`,
    );
  }
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
      // Kept for editors who want a per-category label colour later; the public
      // surface renders every category from the single accent plus its icon and
      // word (docs/DESIGN-SYSTEM.md §1), so nothing reads this today.
      colorToken: cat.code,
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

/* ------------------------- skills and courses ------------------------ */

/**
 * The global half of `operations.skills` (docs/DATABASE-SCHEMA.md §12). A permit
 * category, a first-aid certificate and a shared tool mean the same thing in
 * every association, so InfoKit authors them once and nobody retypes them — an
 * association only creates what is genuinely its own. `organization_id` is null
 * on every row here, which the table's check turns into network-wide reach.
 *
 * `verificationRequired` is the honest question "would a coordinator want this
 * looked at before counting on it?": a licence category yes, a tool somebody was
 * shown how to use no. `validityMonths` is only set where the certificate itself
 * has to be renewed. No `referenceUrl` is seeded: a link belongs to whoever
 * maintains the row, and a wrong one is worse than none.
 */
const GLOBAL_SKILLS: {
  kind: (typeof s.skillKind.enumValues)[number];
  code: string;
  name: Tri;
  descriptionFr?: string;
  verificationRequired: boolean;
  validityMonths?: number;
}[] = [
  {
    kind: "driving_permit",
    code: "permit-b",
    name: {
      fr: "Permis B (voiture)",
      en: "Category B licence (car)",
      ar: "رخصة الفئة B (سيارة)",
    },
    descriptionFr:
      "Permis de conduire de catégorie B. La condition la plus courante d’une maraude motorisée.",
    verificationRequired: true,
  },
  {
    kind: "driving_permit",
    code: "permit-be",
    name: {
      fr: "Permis BE (voiture avec remorque)",
      en: "Category BE licence (car with trailer)",
      ar: "رخصة الفئة BE (سيارة مع مقطورة)",
    },
    descriptionFr:
      "Permis de catégorie BE, pour tirer une remorque au-delà du poids autorisé par le permis B.",
    verificationRequired: true,
  },
  {
    kind: "driving_permit",
    code: "permit-c",
    name: {
      fr: "Permis C (poids lourd)",
      en: "Category C licence (lorry)",
      ar: "رخصة الفئة C (شاحنة)",
    },
    descriptionFr: "Permis de catégorie C, pour les camions de livraison.",
    verificationRequired: true,
  },
  {
    kind: "driving_permit",
    code: "permit-d",
    name: {
      fr: "Permis D (transport de personnes)",
      en: "Category D licence (passenger transport)",
      ar: "رخصة الفئة D (نقل الأشخاص)",
    },
    descriptionFr:
      "Permis de catégorie D, pour les minibus et autocars transportant des personnes.",
    verificationRequired: true,
  },
  {
    kind: "certification",
    code: "psc1",
    name: {
      fr: "PSC1 (prévention et secours civiques niveau 1)",
      en: "PSC1 (French civil first aid, level 1)",
      ar: "PSC1 (الإسعافات الأولية المدنية، المستوى الأول)",
    },
    descriptionFr:
      "Certificat de prévention et secours civiques de niveau 1. Pas de date de fin réglementaire ; une remise à niveau reste recommandée.",
    verificationRequired: true,
  },
  {
    kind: "certification",
    code: "sst",
    name: {
      fr: "SST (sauveteur secouriste du travail)",
      en: "SST (workplace first aider)",
      ar: "SST (مسعف في مكان العمل)",
    },
    descriptionFr:
      "Certificat de sauveteur secouriste du travail, à renouveler tous les 24 mois.",
    verificationRequired: true,
    validityMonths: 24,
  },
  {
    kind: "certification",
    code: "hygiene-alimentaire",
    name: {
      fr: "Hygiène alimentaire (HACCP)",
      en: "Food hygiene (HACCP)",
      ar: "سلامة الغذاء (HACCP)",
    },
    descriptionFr:
      "Formation à l’hygiène alimentaire, demandée pour préparer et distribuer des repas.",
    verificationRequired: true,
  },
  {
    kind: "software",
    code: "mano",
    name: {
      fr: "Mano (suivi social)",
      en: "Mano (social follow-up)",
      ar: "Mano (المتابعة الاجتماعية)",
    },
    descriptionFr:
      "Sait utiliser Mano, l’outil de suivi social partagé par plusieurs maraudes.",
    verificationRequired: false,
  },
  {
    kind: "software",
    code: "kobotoolbox",
    name: {
      fr: "KoBoToolbox (collecte de données)",
      en: "KoBoToolbox (data collection)",
      ar: "KoBoToolbox (جمع البيانات)",
    },
    descriptionFr:
      "Sait construire et remplir un formulaire de collecte sur KoBoToolbox.",
    verificationRequired: false,
  },
  {
    kind: "software",
    code: "signal",
    name: {
      fr: "Signal (messagerie chiffrée)",
      en: "Signal (encrypted messaging)",
      ar: "Signal (مراسلة مشفّرة)",
    },
    descriptionFr:
      "Sait travailler avec Signal, utilisé pour la coordination de terrain.",
    verificationRequired: false,
  },
  {
    kind: "skill",
    code: "interpreting",
    name: {
      fr: "Interprétariat",
      en: "Interpreting",
      ar: "الترجمة الشفوية",
    },
    descriptionFr:
      "Traduit une conversation en direct. Distinct des langues parlées, qui se déclarent dans le profil.",
    verificationRequired: false,
  },
  {
    kind: "skill",
    code: "intercultural-mediation",
    name: {
      fr: "Médiation interculturelle",
      en: "Intercultural mediation",
      ar: "الوساطة الثقافية",
    },
    descriptionFr:
      "Accompagne une rencontre entre une personne et une institution, au-delà de la traduction.",
    verificationRequired: false,
  },
  {
    kind: "skill",
    code: "active-listening",
    name: {
      fr: "Écoute active",
      en: "Active listening",
      ar: "الإنصات الفعّال",
    },
    descriptionFr: "Mène un entretien d’accueil et sait orienter ensuite.",
    verificationRequired: false,
  },
  {
    kind: "skill",
    code: "administrative-support",
    name: {
      fr: "Accompagnement administratif",
      en: "Administrative support",
      ar: "المواكبة الإدارية",
    },
    descriptionFr:
      "Aide à constituer et suivre un dossier auprès d’une administration.",
    verificationRequired: false,
  },
];

/**
 * Global courses: the induction every association ends up giving, written once.
 * A platform course carries the three workspace languages, because it is read in
 * all of them, and no `url` — InfoKit does not deliver these itself, so there is
 * nothing honest to link yet.
 */
const GLOBAL_COURSES: {
  slug: string;
  title: Tri;
  description: string;
  verificationRequired: boolean;
  validityMonths?: number;
}[] = [
  {
    slug: "accueil-orientation-personnes-exilees",
    title: {
      fr: "Accueil et orientation des personnes exilées",
      en: "Welcoming and orienting displaced people",
      ar: "استقبال وتوجيه الأشخاص المهاجرين",
    },
    description:
      "Les bases communes à toutes les associations du réseau : premier accueil, ce qui se dit et ce qui ne se dit pas, vers qui orienter.",
    verificationRequired: false,
  },
  {
    slug: "donnees-personnelles-et-confidentialite",
    title: {
      fr: "Données personnelles et confidentialité",
      en: "Personal data and confidentiality",
      ar: "المعطيات الشخصية والسرية",
    },
    description:
      "Ce qui peut être noté sur une personne, qui y accède, et pendant combien de temps.",
    verificationRequired: false,
  },
];

/**
 * Upserts keyed on the scope-unique pair, not on `code` alone: the same code may
 * exist twice, once globally and once inside an association, so the lookup has
 * to say `organization_id is null` out loud. Drizzle cannot name an expression
 * index as a conflict target, hence select-then-write rather than
 * `onConflictDoUpdate`.
 */
async function seedGlobalSkills() {
  for (const skill of GLOBAL_SKILLS) {
    const values = {
      kind: skill.kind,
      code: skill.code,
      nameFr: skill.name.fr,
      nameEn: skill.name.en,
      nameAr: skill.name.ar,
      descriptionFr: skill.descriptionFr ?? null,
      /** A global row has no organisation to be kept in (the table checks it). */
      visibility: "all_organizations_and_translators" as const,
      verificationRequired: skill.verificationRequired,
      validityMonths: skill.validityMonths ?? null,
      active: true,
    };
    const [existing] = await db
      .select({ id: s.skills.id })
      .from(s.skills)
      .where(
        and(
          isNull(s.skills.organizationId),
          eq(s.skills.kind, skill.kind),
          eq(s.skills.code, skill.code),
        ),
      )
      .limit(1);
    if (existing) {
      await db.update(s.skills).set(values).where(eq(s.skills.id, existing.id));
      continue;
    }
    const [inserted] = await db
      .insert(s.skills)
      .values({ organizationId: null, ...values })
      .returning({ id: s.skills.id });
    must(inserted, `global skill ${skill.code}`);
  }
  console.log(`global skills: ${String(GLOBAL_SKILLS.length)}`);
}

async function seedGlobalCourses() {
  for (const course of GLOBAL_COURSES) {
    const values = {
      slug: course.slug,
      title: course.title.fr,
      titleEn: course.title.en,
      titleAr: course.title.ar,
      description: course.description,
      visibility: "all_organizations_and_translators" as const,
      provider: "InfoKit",
      sourceLanguageCode: "fr",
      verificationRequired: course.verificationRequired,
      validityMonths: course.validityMonths ?? null,
      active: true,
    };
    const [existing] = await db
      .select({ id: s.trainingCourses.id })
      .from(s.trainingCourses)
      .where(
        and(
          isNull(s.trainingCourses.organizationId),
          eq(s.trainingCourses.slug, course.slug),
        ),
      )
      .limit(1);
    if (existing) {
      await db
        .update(s.trainingCourses)
        .set(values)
        .where(eq(s.trainingCourses.id, existing.id));
      continue;
    }
    const [inserted] = await db
      .insert(s.trainingCourses)
      .values({ organizationId: null, ...values })
      .returning({ id: s.trainingCourses.id });
    must(inserted, `global course ${course.slug}`);
  }
  console.log(`global courses: ${String(GLOBAL_COURSES.length)}`);
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
  /**
   * Basic information gets its own two grants rather than riding the article
   * ones, because of what is behind it: the number someone dials from a sinking
   * boat, and the sentence telling them when to dial it.
   *
   * `content.article.write` is held by `organization_author` — a grant an
   * association hands to whoever writes its news. That is the right level of
   * trust for an article and the wrong one for 112, so these codes go to the
   * platform's own content role and to nobody else. An association correcting
   * its own help line is a custody question (PRODUCT.md §14.5), not a reason to
   * widen the grant that also covers the state's emergency numbers.
   */
  {
    code: "content.basic_information.write",
    description:
      "Create, edit, and translate basic-information tiles and emergency numbers",
  },
  {
    code: "content.basic_information.publish",
    description:
      "Publish, unpublish, and archive basic-information tiles and emergency numbers",
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
    code: "content.translation.verify",
    description:
      "Confirm that a machine-generated translation has been checked by a person who reads the language",
  },
  {
    code: "translator.directory.manage",
    description:
      "Invite external translators, maintain their directory entries, and decide how widely they are offered",
  },
  {
    code: "translator.workspace.read",
    description:
      "Read the translation assignments addressed to this translator, and nothing else",
  },
  {
    code: "translator.profile.manage",
    description:
      "Maintain one's own translator profile, working languages, and course claims",
  },
  {
    code: "platform.staff.manage",
    description:
      "Invite platform staff and grant or revoke platform-level roles",
  },
  {
    code: "platform.staff.read",
    description:
      "Read the platform staff list and the roles each account holds, without changing any of it",
  },
  {
    code: "courses.manage",
    description:
      "Maintain the organisation's training/course catalogue and how widely each course is shared",
  },
  {
    code: "courses.qualification.verify",
    description:
      "Accept or refuse a declared course completion for a member or an external translator",
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
const ROLES: {
  code: string;
  description: string;
  permissions: string[];
  /**
   * Set on the roles whose reach makes the SMS step-up non-negotiable: the
   * platform's own staff, and the steward of an organisation's members and
   * roles. Everything narrower — publishing, verifying, translating — leaves
   * the choice to the person, so an invited translator is never asked for a
   * phone number to do their own work.
   */
  requiresSecondFactor?: true;
}[] = [
  {
    code: "platform_superadmin",
    description:
      "Performs audited platform support, staffing, and organisation-context switching",
    /**
     * The technical account: support access, the audit trail, and the authority
     * to staff the platform. It deliberately grants no content capability —
     * writing and publishing platform content is `platform_content_manager`,
     * invited separately, so day-to-day content work is not done from the
     * account that can enter any organisation's context.
     */
    permissions: [
      "support.superadmin",
      "platform.staff.manage",
      // Held explicitly rather than inferred from `manage`: the page's read gate
      // asks one question, and a role that may change the list can obviously see
      // it. Spelling it out keeps the gate a single `has(read)` check.
      "platform.staff.read",
      "audit.read",
    ],
    requiresSecondFactor: true,
  },
  {
    code: "platform_operator",
    description:
      "Maintains and verifies unclaimed organisations, taxonomies, and audit events",
    /**
     * `organization.profile.manage` is what lets the platform keep a directory
     * record accurate before the organisation claims it; the claim rule
     * (server/auth/org-access.ts) turns that write access into read-only the
     * moment an org steward links their account.
     */
    permissions: [
      "organization.verify",
      "organization.profile.manage",
      "taxonomy.manage",
      "translator.directory.manage",
      "courses.manage",
      "audit.read",
    ],
    requiresSecondFactor: true,
  },
  {
    code: "platform_content_manager",
    description:
      "Maintains platform public content and proxy-publishes with recorded approval",
    /**
     * The content half of the platform, invited by the superadmin
     * (`core.invitations`, kind `platform_admin`). It holds no support access,
     * no organisation verification, and no staffing power: it writes, reviews,
     * translates, and publishes.
     */
    permissions: [
      "content.article.write",
      "content.article.review",
      "content.article.publish",
      // The only role that carries these: see the note on the two codes.
      "content.basic_information.write",
      "content.basic_information.publish",
      "content.activity.manage",
      "content.activity.verify",
      "content.simulator.review",
      "content.translation.request",
      "content.translation.review",
      "content.translation.verify",
      /**
       * The agenda is content. Coordination events are published to the same
       * readers as activities and articles, and the role that writes those was
       * the one role that could open `/dashboard/events` and find no way to add
       * anything — the create button reads this grant, so its absence read as a
       * broken page rather than as a boundary.
       */
      "coordination.event.manage",
      /**
       * Read-only over the staff list. Knowing who holds which platform role is
       * part of maintaining the platform, and this grant is deliberately not
       * `platform.staff.manage`: inviting staff and moving grants around stays
       * with the superadmin, and every mutation on that page still asks for the
       * manage code.
       */
      "platform.staff.read",
    ],
    requiresSecondFactor: true,
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
    permissions: [
      "content.translation.review",
      "content.translation.verify",
      "content.article.review",
    ],
  },
  {
    code: "organization_admin",
    description:
      "Maintains an organisation profile, memberships, roles, and city teams",
    /**
     * `teams.manage` is held here as well as by `coordinator` and `team_lead`.
     * Day-to-day team work is still a coordinator's job, but somebody has to be
     * able to create the first city team and place the first member — and the
     * account that admits people to the organisation is the only one that
     * reliably exists before any coordinator has been appointed. Without it the
     * administrator met a board of controls that could only fail.
     *
     * No `audit.read`, still. The trail is one cross-organisation record: it
     * names the actors, refusals and delivery attempts of every organisation on
     * the platform, so reading it is a platform operator's job. Giving an
     * organisation its own slice is a feature with its own redaction question —
     * which of its members' reads it may see, and whose addresses stay hidden —
     * and not something a membership role should confer as a side effect.
     *
     * `requiresSecondFactor` stays: `members.read` still reaches colleagues'
     * personal data (RISKS.md R10).
     */
    permissions: [
      "organization.profile.manage",
      "members.read",
      "members.manage",
      "roles.manage",
      "teams.manage",
      "translator.directory.manage",
      "courses.manage",
      "courses.qualification.verify",
    ],
    requiresSecondFactor: true,
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
    code: "translator",
    /**
     * The external translator's own role, granted globally in
     * `core.user_platform_roles` because they hold no membership anywhere. It
     * is the smallest role in the catalogue on purpose: the content they see is
     * whatever was sent to them — assignments linked to their
     * `core.translators` entry — plus their own profile. No organisation
     * content, no member data, no other translator's work.
     */
    description:
      "Works the translations sent to them and maintains their own translator profile",
    permissions: [
      "translator.workspace.read",
      "content.translation.submit",
      "translator.profile.manage",
    ],
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
      "courses.qualification.verify",
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

/**
 * Platform role templates renamed after accounts were already granted them.
 * Renaming the row keeps every `user_platform_roles` assignment intact, which
 * dropping and recreating the role would not.
 */
const LEGACY_ROLE_RENAMES = [
  ["platform_editor", "platform_content_manager"],
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

    for (const [legacyCode, replacementCode] of LEGACY_ROLE_RENAMES) {
      const platformCodes = await tx
        .select({ code: s.roles.code })
        .from(s.roles)
        .where(
          and(
            inArray(s.roles.code, [legacyCode, replacementCode]),
            isNull(s.roles.organizationId),
          ),
        );
      const renameable =
        platformCodes.some((row) => row.code === legacyCode) &&
        !platformCodes.some((row) => row.code === replacementCode);
      if (!renameable) continue;
      await tx
        .update(s.roles)
        .set({ code: replacementCode })
        .where(
          and(eq(s.roles.code, legacyCode), isNull(s.roles.organizationId)),
        );
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
      const template = {
        code: role.code,
        description: role.description,
        requiresSecondFactor: role.requiresSecondFactor ?? false,
      };
      let roleId = platformRoles.get(role.code);
      if (roleId === undefined) {
        const [row] = await tx
          .insert(s.roles)
          .values(template)
          .returning({ id: s.roles.id });
        roleId = must(row, `role ${role.code}`).id;
      } else {
        await tx
          .update(s.roles)
          .set({
            description: template.description,
            requiresSecondFactor: template.requiresSecondFactor,
          })
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
 * The platform roles the first staff account receives: the technical pair.
 * Support access on its own grants no editing, so `platform_operator` is what
 * makes the platform side of the dashboard usable — verifying organisations,
 * taxonomies, the translator directory, the audit trail.
 *
 * `platform_content_manager` is deliberately not here. Content is somebody's
 * job, not the superadmin's: this account invites that person
 * (`core.invitations`, kind `platform_admin`) and the grant lands in
 * `core.user_platform_roles` on acceptance.
 */
const BOOTSTRAP_ROLES = ["platform_superadmin", "platform_operator"] as const;

/**
 * Grants the platform roles to the account selected by deployment
 * configuration. A clean local database may not have seen its first Auth.js
 * sign-in yet, so the configured bootstrap identity is created when absent. The
 * address still comes only from environment configuration and is never stored
 * in source.
 */
async function seedBootstrapSuperadmin() {
  const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log("bootstrap superadmin: skipped (email not configured)");
    return;
  }

  const [[existingUser], roleRows] = await Promise.all([
    db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.email, email))
      .limit(1),
    db
      .select({ id: s.roles.id, code: s.roles.code })
      .from(s.roles)
      .where(
        and(
          inArray(s.roles.code, [...BOOTSTRAP_ROLES]),
          isNull(s.roles.organizationId),
        ),
      ),
  ]);
  const missing = BOOTSTRAP_ROLES.filter(
    (code) => !roleRows.some((row) => row.code === code),
  );
  if (missing.length > 0) {
    throw new Error(`Platform roles were not seeded: ${missing.join(", ")}`);
  }

  /**
   * `emailVerified: true`, and it is not a shortcut.
   *
   * Better Auth treats an `emailVerified: false` row as an account whose
   * password nobody has proved belongs to the mailbox owner — so when a magic
   * link resolves to one, `revokeUnprovenAccountAccess` deletes its credential
   * and revokes its sessions before minting the owner's. That is right in
   * general, and wrong here: this address comes from deployment configuration
   * and every other account arrives by invitation, so the address is known good
   * before anyone signs in. Left false, the first emailed link would silently
   * delete the password this very function just set.
   */
  const [createdUser] = existingUser
    ? []
    : await db
        .insert(s.users)
        .values({ email, emailVerified: true })
        .returning({ id: s.users.id });
  const user = existingUser ?? createdUser;
  if (!user)
    throw new Error("Bootstrap superadmin account could not be created");

  if (existingUser) {
    await db
      .update(s.users)
      .set({ emailVerified: true })
      .where(eq(s.users.id, user.id));
  }

  await db
    .insert(s.userPlatformRoles)
    .values(
      roleRows.map((role) => ({
        userId: user.id,
        roleId: role.id,
        grantedById: user.id,
      })),
    )
    .onConflictDoNothing();

  const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
  if (password) {
    if (password.length < 12 || password.length > 128) {
      throw new Error("Bootstrap password must contain 12 to 128 characters");
    }
    /**
     * The password lives on the `credential` row of `auth.accounts`, which is
     * where Better Auth reads it — not on `auth.users`, which no longer has a
     * column for one. `hashPassword` is Better Auth's own hasher, imported so
     * that a seeded password and one set through the console are the same
     * record and verify identically.
     */
    const passwordHash = await hashPassword(password);
    await db
      .insert(s.accounts)
      .values({
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      })
      .onConflictDoUpdate({
        target: [s.accounts.providerId, s.accounts.accountId],
        set: { password: passwordHash, updatedAt: new Date() },
      });
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
  await seedGlobalSkills();
  await seedGlobalCourses();
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
