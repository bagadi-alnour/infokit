import {
  taxonomyEntry,
  type TaxonomyKind,
} from "@infokit/shared/i18n/taxonomy";

export const publicLanguageCodes = [
  "fr",
  "en",
  "ar",
  "fa",
  "prs",
  "ps",
  "ckb",
  "ti",
  "am",
  "om",
  "so",
] as const;

export type PublicLanguageCode = (typeof publicLanguageCodes)[number];
export type PublicTranslation = Record<PublicLanguageCode, string>;

/**
 * Labels are owned by the shared taxonomy JSON (packages/shared/src/i18n/
 * taxonomy/*.json), keyed by `code` in all supported public languages. The
 * public site resolves them from JSON with no database round-trip; this seed
 * mirrors the same JSON into the DB translation tables the editor reads, so
 * there is a single source of truth. Structural metadata (code, icon, and a
 * service's parent category) stays here because it shapes rows, not text.
 */
function labelFor(kind: TaxonomyKind, code: string): PublicTranslation {
  const entry = taxonomyEntry(kind, code);
  if (!entry) throw new Error(`Missing taxonomy label for ${kind}.${code}`);
  return entry;
}

const SERVICE_CATEGORY_META = [
  { code: "essentials", icon: "utensils" },
  { code: "hygiene_material", icon: "shower-head" },
  { code: "health_wellbeing", icon: "heart" },
  { code: "legal_orientation", icon: "scale" },
  { code: "shelter_access", icon: "home" },
  { code: "connectivity", icon: "phone" },
  { code: "community", icon: "sparkles" },
] as const;

export const PUBLIC_SERVICE_CATEGORIES = SERVICE_CATEGORY_META.map((meta) => ({
  code: meta.code,
  icon: meta.icon,
  label: labelFor("categories", meta.code),
}));

const GLOBAL_SERVICE_META = [
  { code: "food", category: "essentials", icon: "utensils" },
  { code: "drinking_water", category: "essentials", icon: "droplet" },
  { code: "clothing_shoes", category: "shelter_access", icon: "shirt" },
  { code: "showers_hygiene", category: "hygiene_material", icon: "shower" },
  { code: "tents_bedding", category: "shelter_access", icon: "tent" },
  { code: "phone_connectivity", category: "connectivity", icon: "phone" },
  { code: "healthcare", category: "health_wellbeing", icon: "heart" },
  {
    code: "asylum_legal_information",
    category: "legal_orientation",
    icon: "scale",
  },
  { code: "day_services", category: "shelter_access", icon: "home" },
  { code: "activities", category: "community", icon: "sparkles" },
  {
    code: "information_orientation",
    category: "legal_orientation",
    icon: "help",
  },
  { code: "tea", category: "essentials", icon: "cup-soda" },
  { code: "coffee", category: "essentials", icon: "coffee" },
  { code: "toilets", category: "hygiene_material", icon: "toilet" },
] as const;

export const GLOBAL_SERVICES = GLOBAL_SERVICE_META.map((meta) => ({
  code: meta.code,
  category: meta.category,
  icon: meta.icon,
  label: labelFor("services", meta.code),
}));

const GLOBAL_TAG_META = [
  { code: "urgent", icon: "alert" },
  { code: "walk_in", icon: "door" },
  { code: "appointment_required", icon: "calendar" },
  { code: "mobile", icon: "map" },
  { code: "free", icon: "gift" },
  { code: "accessible", icon: "accessibility" },
  { code: "documents_required", icon: "file" },
  { code: "seasonal", icon: "calendar" },
] as const;

export const GLOBAL_TAGS = GLOBAL_TAG_META.map((meta) => ({
  code: meta.code,
  icon: meta.icon,
  label: labelFor("tags", meta.code),
}));

const PUBLIC_AUDIENCE_CODES = [
  "all_public",
  "women_only",
  "children_only",
  "under_18_only",
  "families_only",
  "adult_men_only",
] as const;

export const PUBLIC_AUDIENCES = PUBLIC_AUDIENCE_CODES.map((code) => ({
  code,
  label: labelFor("audiences", code),
}));

const SPECIALITY_META = [
  { code: "medical", icon: "stethoscope", displayOrder: 1 },
  { code: "medication", icon: "pill", displayOrder: 2 },
  { code: "mental", icon: "brain", displayOrder: 3 },
  { code: "food", icon: "utensils", displayOrder: 4 },
  { code: "water", icon: "droplet", displayOrder: 5 },
  { code: "hygiene", icon: "shower", displayOrder: 6 },
  { code: "clothing", icon: "shirt", displayOrder: 7 },
  { code: "material", icon: "tent", displayOrder: 8 },
  { code: "legal", icon: "scale", displayOrder: 9 },
  { code: "info", icon: "help", displayOrder: 10 },
  { code: "mediation", icon: "languages", displayOrder: 11 },
  { code: "charging", icon: "zap", displayOrder: 12 },
  { code: "activities", icon: "sparkles", displayOrder: 13 },
] as const;

export const SPECIALITIES = SPECIALITY_META.map((meta) => ({
  code: meta.code,
  icon: meta.icon,
  displayOrder: meta.displayOrder,
  label: labelFor("specialities", meta.code),
}));
