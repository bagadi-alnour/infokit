/* eslint-disable no-console -- CLI seed script reports progress to stdout */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as s from "./schema";

/**
 * Catalogue seeds — idempotent upserts keyed on `code` (ENGINEERING-NOTES §4).
 * Catalogues are data: adding a city or language later is an insert, never a
 * migration. Deliberately NOT seeded: organisations, places, services,
 * editorial content, users — real Calais data enters through the editor
 * console with sourceNote + unverified state (PRODUCT.md §8.1), and demo
 * fixtures must carry the "Demo data — do not publish" label (AGENTS.md).
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
  // Present but disabled: a language ships only when a named person owns
  // its review (PRODUCT.md §17).
  {
    code: "ps",
    nativeName: "پښتو",
    englishName: "Pashto",
    frenchName: "Pachto",
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

/* --------------------------- service categories ---------------------- */

const CATEGORIES: {
  code: string;
  icon: string;
  displayOrder: number;
  label: Tri;
}[] = [
  {
    code: "food",
    icon: "utensils",
    displayOrder: 1,
    label: { en: "Food", fr: "Nourriture", ar: "طعام" },
  },
  {
    code: "water",
    icon: "droplet",
    displayOrder: 2,
    label: { en: "Drinking water", fr: "Eau potable", ar: "ماء الشرب" },
  },
  {
    code: "clothing",
    icon: "shirt",
    displayOrder: 3,
    label: {
      en: "Clothing & shoes",
      fr: "Vêtements & chaussures",
      ar: "ملابس وأحذية",
    },
  },
  {
    code: "showers",
    icon: "shower",
    displayOrder: 4,
    label: {
      en: "Showers & hygiene",
      fr: "Douches & hygiène",
      ar: "استحمام ونظافة",
    },
  },
  {
    code: "material",
    icon: "tent",
    displayOrder: 5,
    label: {
      en: "Tents & bedding",
      fr: "Tentes & couchage",
      ar: "خيام وأغطية",
    },
  },
  {
    code: "charging",
    icon: "phone",
    displayOrder: 6,
    label: {
      en: "Phone & connectivity",
      fr: "Téléphone & connexion",
      ar: "الهاتف والاتصال",
    },
  },
  {
    code: "health",
    icon: "heart",
    displayOrder: 7,
    label: { en: "Healthcare", fr: "Santé", ar: "رعاية صحية" },
  },
  {
    code: "legal",
    icon: "scale",
    displayOrder: 8,
    label: {
      en: "Asylum & legal info",
      fr: "Asile & info juridique",
      ar: "معلومات اللجوء والقانون",
    },
  },
  {
    code: "shelter",
    icon: "home",
    displayOrder: 9,
    label: { en: "Day services", fr: "Accueil de jour", ar: "خدمات نهارية" },
  },
  {
    code: "activities",
    icon: "sparkles",
    displayOrder: 10,
    label: { en: "Activities", fr: "Activités", ar: "أنشطة" },
  },
  {
    code: "info",
    icon: "help",
    displayOrder: 11,
    label: { en: "Information", fr: "Information", ar: "معلومات" },
  },
];

async function seedCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const values = {
      code: cat.code,
      icon: cat.icon,
      colorToken: cat.code, // resolved against @calais/tokens categoryAccents
      enabled: true,
      displayOrder: cat.displayOrder,
    };
    const [row] = await db
      .insert(s.serviceCategories)
      .values(values)
      .onConflictDoUpdate({ target: s.serviceCategories.code, set: values })
      .returning({ id: s.serviceCategories.id });
    const id = must(row, `category ${cat.code}`).id;
    ids.set(cat.code, id);
    for (const locale of LOCALES) {
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
  console.log(`service categories: ${String(CATEGORIES.length)}`);
  return ids;
}

/* --------------------------- audience categories --------------------- */

const AUDIENCES: { code: string; displayOrder: number; label: Tri }[] = [
  {
    code: "all_public",
    displayOrder: 1,
    label: { en: "All public", fr: "Tout public", ar: "للجميع" },
  },
  {
    code: "women_only",
    displayOrder: 2,
    label: { en: "Women only", fr: "Femmes uniquement", ar: "للنساء فقط" },
  },
  {
    code: "children_only",
    displayOrder: 3,
    label: { en: "Children only", fr: "Enfants uniquement", ar: "للأطفال فقط" },
  },
  {
    code: "under_18_only",
    displayOrder: 4,
    label: { en: "Under 18 only", fr: "Moins de 18 ans", ar: "لمن هم دون 18" },
  },
  {
    code: "families_only",
    displayOrder: 5,
    label: {
      en: "Families only",
      fr: "Familles uniquement",
      ar: "للعائلات فقط",
    },
  },
  {
    code: "adult_men_only",
    displayOrder: 6,
    label: {
      en: "Adult men only",
      fr: "Hommes adultes",
      ar: "للرجال البالغين",
    },
  },
];

async function seedAudiences() {
  for (const aud of AUDIENCES) {
    const values = {
      code: aud.code,
      icon: "users",
      enabled: true,
      displayOrder: aud.displayOrder,
    };
    const [row] = await db
      .insert(s.audienceCategories)
      .values(values)
      .onConflictDoUpdate({ target: s.audienceCategories.code, set: values })
      .returning({ id: s.audienceCategories.id });
    const id = must(row, `audience ${aud.code}`).id;
    for (const locale of LOCALES) {
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
  console.log(`audience categories: ${String(AUDIENCES.length)}`);
}

/* ------------------------------ specialities ------------------------- */

const SPECIALITIES: {
  code: string;
  icon: string;
  displayOrder: number;
  label: Tri;
}[] = [
  {
    code: "medical",
    icon: "stethoscope",
    displayOrder: 1,
    label: { en: "Medical care", fr: "Soins médicaux", ar: "رعاية طبية" },
  },
  {
    code: "medication",
    icon: "pill",
    displayOrder: 2,
    label: { en: "Medication", fr: "Médicaments", ar: "أدوية" },
  },
  {
    code: "mental",
    icon: "brain",
    displayOrder: 3,
    label: {
      en: "Mental-health support",
      fr: "Soutien psychologique",
      ar: "دعم نفسي",
    },
  },
  {
    code: "food",
    icon: "utensils",
    displayOrder: 4,
    label: { en: "Food", fr: "Nourriture", ar: "طعام" },
  },
  {
    code: "water",
    icon: "droplet",
    displayOrder: 5,
    label: { en: "Drinking water", fr: "Eau potable", ar: "ماء الشرب" },
  },
  {
    code: "hygiene",
    icon: "shower",
    displayOrder: 6,
    label: {
      en: "Showers & hygiene",
      fr: "Douches & hygiène",
      ar: "استحمام ونظافة",
    },
  },
  {
    code: "clothing",
    icon: "shirt",
    displayOrder: 7,
    label: { en: "Clothing", fr: "Vêtements", ar: "ملابس" },
  },
  {
    code: "material",
    icon: "tent",
    displayOrder: 8,
    label: {
      en: "Tents & bedding",
      fr: "Tentes & couchage",
      ar: "خيام وأغطية",
    },
  },
  {
    code: "legal",
    icon: "scale",
    displayOrder: 9,
    label: {
      en: "Legal assistance",
      fr: "Aide juridique",
      ar: "مساعدة قانونية",
    },
  },
  {
    code: "info",
    icon: "help",
    displayOrder: 10,
    label: {
      en: "Information & orientation",
      fr: "Information & orientation",
      ar: "معلومات وتوجيه",
    },
  },
  {
    code: "mediation",
    icon: "languages",
    displayOrder: 11,
    label: {
      en: "Translation & mediation",
      fr: "Traduction & médiation",
      ar: "ترجمة ووساطة",
    },
  },
  {
    code: "charging",
    icon: "zap",
    displayOrder: 12,
    label: {
      en: "Phone & connectivity",
      fr: "Téléphone & connexion",
      ar: "الهاتف والاتصال",
    },
  },
  {
    code: "activities",
    icon: "sparkles",
    displayOrder: 13,
    label: { en: "Activities & play", fr: "Activités & jeu", ar: "أنشطة ولعب" },
  },
];

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
    for (const locale of LOCALES) {
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

async function seedConcepts(categoryIds: Map<string, string>) {
  for (const concept of CONCEPTS) {
    const values = {
      code: concept.code,
      categoryId: must(
        categoryIds.get(concept.category),
        `category ${concept.category}`,
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
    code: "content.article.create",
    description: "Create and translate owned articles",
  },
  {
    code: "content.article.publish",
    description: "Publish, unpublish, and archive owned articles",
  },
  {
    code: "content.service.manage",
    description: "Maintain places, services, schedules, and events",
  },
  {
    code: "content.simulator.review",
    description: "Maintain and review simulator flows",
  },
  {
    code: "organization.profile.manage",
    description: "Maintain the public organisation profile",
  },
  { code: "audit.read", description: "Read audit history" },
];

/** Platform role templates (organizationId null) for Phase 1 actors. */
const ROLES: { code: string; description: string; permissions: string[] }[] = [
  {
    code: "platform_operator",
    description:
      "Verifies organisations, maintains taxonomies, investigates audit events",
    permissions: PERMISSIONS.map((p) => p.code),
  },
  {
    code: "platform_editor",
    description:
      "Maintains platform public content and proxy-publishes with recorded approval",
    permissions: [
      "content.article.create",
      "content.article.publish",
      "content.service.manage",
      "content.simulator.review",
    ],
  },
  {
    code: "association_author",
    description: "Creates and translates articles owned by their association",
    permissions: ["content.article.create"],
  },
  {
    code: "association_publisher",
    description: "Creates and publishes articles owned by their association",
    permissions: ["content.article.create", "content.article.publish"],
  },
];

async function seedRoles() {
  for (const perm of PERMISSIONS) {
    await db
      .insert(s.permissions)
      .values(perm)
      .onConflictDoUpdate({ target: s.permissions.code, set: perm });
  }
  const existing = await db
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
      const [row] = await db
        .insert(s.roles)
        .values({ code: role.code, description: role.description })
        .returning({ id: s.roles.id });
      roleId = must(row, `role ${role.code}`).id;
    }
    for (const permissionCode of role.permissions) {
      await db
        .insert(s.rolePermissions)
        .values({ roleId, permissionCode })
        .onConflictDoNothing();
    }
  }
  console.log(
    `permissions: ${String(PERMISSIONS.length)}, platform roles: ${String(ROLES.length)}`,
  );
}

/* -------------------------------- main -------------------------------- */

async function main() {
  console.log("Seeding catalogues (idempotent)…");
  await seedLanguages();
  await seedCalais();
  const categoryIds = await seedCategories();
  await seedAudiences();
  await seedSpecialities();
  await seedConcepts(categoryIds);
  await seedRoles();
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
