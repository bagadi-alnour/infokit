import {
  translatedInterfaceLocales,
  type PublicLocale,
  type TranslatedInterfaceLocale,
} from "./index";

/**
 * Locales beyond the fully-translated interface set (fr/en/ar) may still
 * translate stable UI chrome — navbar, filters, status — without owning a
 * full catalogue. Their partial files overlay the English base, so untranslated
 * keys fall back to English rather than blanking. A locale gains an overlay by
 * adding a file here; everything else keeps the English base.
 */
type PartialCatalog<Name extends CatalogName> = Partial<CatalogMap[Name]>;
type PartialLoader<Name extends CatalogName> = () => Promise<
  PartialCatalog<Name>
>;
type OverlayLoaders = Partial<{
  [Name in CatalogName]: PartialLoader<Name>;
}>;

export interface CatalogMap {
  "auth-delivery": typeof import("./messages/en/auth-delivery.json");
  common: typeof import("./messages/en/common.json");
  "dashboard-account": typeof import("./messages/en/dashboard-account.json");
  "dashboard-articles": typeof import("./messages/en/dashboard-articles.json");
  "dashboard-catalogue": typeof import("./messages/en/dashboard-catalogue.json");
  "dashboard-console": typeof import("./messages/en/dashboard-console.json");
  "dashboard-events": typeof import("./messages/en/dashboard-events.json");
  "dashboard-layout": typeof import("./messages/en/dashboard-layout.json");
  "dashboard-overview": typeof import("./messages/en/dashboard-overview.json");
  "dashboard-places": typeof import("./messages/en/dashboard-places.json");
  "dashboard-simulator": typeof import("./messages/en/dashboard-simulator.json");
  home: typeof import("./messages/en/home.json");
  member: typeof import("./messages/en/member.json");
  login: typeof import("./messages/en/login.json");
  "login-check": typeof import("./messages/en/login-check.json");
  "login-error": typeof import("./messages/en/login-error.json");
  "login-verify": typeof import("./messages/en/login-verify.json");
  "public-simulator": typeof import("./messages/en/public-simulator.json");
  "public-content": typeof import("./messages/en/public-content.json");
}

export type CatalogName = keyof CatalogMap;
export type PageCatalogName = Exclude<CatalogName, "common" | "auth-delivery">;
export type CommonCatalog = CatalogMap["common"];
export type PageCatalog<Name extends PageCatalogName> = CommonCatalog &
  CatalogMap[Name];

type CatalogLoader<Name extends CatalogName> = () => Promise<CatalogMap[Name]>;
type LocaleCatalogLoaders = {
  [Name in CatalogName]: CatalogLoader<Name>;
};

const catalogLoaders = {
  fr: {
    "auth-delivery": async () =>
      (await import("./messages/fr/auth-delivery.json")).default,
    common: async () => (await import("./messages/fr/common.json")).default,
    "dashboard-account": async () =>
      (await import("./messages/fr/dashboard-account.json")).default,
    "dashboard-articles": async () =>
      (await import("./messages/fr/dashboard-articles.json")).default,
    "dashboard-catalogue": async () =>
      (await import("./messages/fr/dashboard-catalogue.json")).default,
    "dashboard-console": async () =>
      (await import("./messages/fr/dashboard-console.json")).default,
    "dashboard-events": async () =>
      (await import("./messages/fr/dashboard-events.json")).default,
    "dashboard-layout": async () =>
      (await import("./messages/fr/dashboard-layout.json")).default,
    "dashboard-overview": async () =>
      (await import("./messages/fr/dashboard-overview.json")).default,
    "dashboard-places": async () =>
      (await import("./messages/fr/dashboard-places.json")).default,
    "dashboard-simulator": async () =>
      (await import("./messages/fr/dashboard-simulator.json")).default,
    home: async () => (await import("./messages/fr/home.json")).default,
    member: async () => (await import("./messages/fr/member.json")).default,
    login: async () => (await import("./messages/fr/login.json")).default,
    "login-check": async () =>
      (await import("./messages/fr/login-check.json")).default,
    "login-error": async () =>
      (await import("./messages/fr/login-error.json")).default,
    "login-verify": async () =>
      (await import("./messages/fr/login-verify.json")).default,
    "public-simulator": async () =>
      (await import("./messages/fr/public-simulator.json")).default,
    "public-content": async () =>
      (await import("./messages/fr/public-content.json")).default,
  },
  en: {
    "auth-delivery": async () =>
      (await import("./messages/en/auth-delivery.json")).default,
    common: async () => (await import("./messages/en/common.json")).default,
    "dashboard-account": async () =>
      (await import("./messages/en/dashboard-account.json")).default,
    "dashboard-articles": async () =>
      (await import("./messages/en/dashboard-articles.json")).default,
    "dashboard-catalogue": async () =>
      (await import("./messages/en/dashboard-catalogue.json")).default,
    "dashboard-console": async () =>
      (await import("./messages/en/dashboard-console.json")).default,
    "dashboard-events": async () =>
      (await import("./messages/en/dashboard-events.json")).default,
    "dashboard-layout": async () =>
      (await import("./messages/en/dashboard-layout.json")).default,
    "dashboard-overview": async () =>
      (await import("./messages/en/dashboard-overview.json")).default,
    "dashboard-places": async () =>
      (await import("./messages/en/dashboard-places.json")).default,
    "dashboard-simulator": async () =>
      (await import("./messages/en/dashboard-simulator.json")).default,
    home: async () => (await import("./messages/en/home.json")).default,
    member: async () => (await import("./messages/en/member.json")).default,
    login: async () => (await import("./messages/en/login.json")).default,
    "login-check": async () =>
      (await import("./messages/en/login-check.json")).default,
    "login-error": async () =>
      (await import("./messages/en/login-error.json")).default,
    "login-verify": async () =>
      (await import("./messages/en/login-verify.json")).default,
    "public-simulator": async () =>
      (await import("./messages/en/public-simulator.json")).default,
    "public-content": async () =>
      (await import("./messages/en/public-content.json")).default,
  },
  ar: {
    "auth-delivery": async () =>
      (await import("./messages/ar/auth-delivery.json")).default,
    common: async () => (await import("./messages/ar/common.json")).default,
    "dashboard-account": async () =>
      (await import("./messages/ar/dashboard-account.json")).default,
    "dashboard-articles": async () =>
      (await import("./messages/ar/dashboard-articles.json")).default,
    "dashboard-catalogue": async () =>
      (await import("./messages/ar/dashboard-catalogue.json")).default,
    "dashboard-console": async () =>
      (await import("./messages/ar/dashboard-console.json")).default,
    "dashboard-events": async () =>
      (await import("./messages/ar/dashboard-events.json")).default,
    "dashboard-layout": async () =>
      (await import("./messages/ar/dashboard-layout.json")).default,
    "dashboard-overview": async () =>
      (await import("./messages/ar/dashboard-overview.json")).default,
    "dashboard-places": async () =>
      (await import("./messages/ar/dashboard-places.json")).default,
    "dashboard-simulator": async () =>
      (await import("./messages/ar/dashboard-simulator.json")).default,
    home: async () => (await import("./messages/ar/home.json")).default,
    member: async () => (await import("./messages/ar/member.json")).default,
    login: async () => (await import("./messages/ar/login.json")).default,
    "login-check": async () =>
      (await import("./messages/ar/login-check.json")).default,
    "login-error": async () =>
      (await import("./messages/ar/login-error.json")).default,
    "login-verify": async () =>
      (await import("./messages/ar/login-verify.json")).default,
    "public-simulator": async () =>
      (await import("./messages/ar/public-simulator.json")).default,
    "public-content": async () =>
      (await import("./messages/ar/public-content.json")).default,
  },
} satisfies Record<TranslatedInterfaceLocale, LocaleCatalogLoaders>;

/**
 * Chrome overlays for the supported public languages that do not yet own a
 * full interface catalogue. Each file holds only the stable UI keys; the rest
 * of the catalogue falls back to English.
 *
 * The `common` overlay carries the form-validation wording. A field that
 * rejects what someone typed has to say why in their language: telling a
 * reader under stress "Check this value" in English is telling them nothing,
 * so that handful of strings is translated in all eleven languages even
 * though the rest of the catalogue still falls back to English.
 */
const overlayLoaders = {
  fa: {
    common: async () => (await import("./messages/fa/common.json")).default,
    "public-content": async () =>
      (await import("./messages/fa/public-content.json")).default,
  },
  prs: {
    common: async () => (await import("./messages/prs/common.json")).default,
    "public-content": async () =>
      (await import("./messages/prs/public-content.json")).default,
  },
  ps: {
    common: async () => (await import("./messages/ps/common.json")).default,
    "public-content": async () =>
      (await import("./messages/ps/public-content.json")).default,
  },
  ckb: {
    common: async () => (await import("./messages/ckb/common.json")).default,
    "public-content": async () =>
      (await import("./messages/ckb/public-content.json")).default,
  },
  ti: {
    common: async () => (await import("./messages/ti/common.json")).default,
    "public-content": async () =>
      (await import("./messages/ti/public-content.json")).default,
  },
  am: {
    common: async () => (await import("./messages/am/common.json")).default,
    "public-content": async () =>
      (await import("./messages/am/public-content.json")).default,
  },
  om: {
    common: async () => (await import("./messages/om/common.json")).default,
    "public-content": async () =>
      (await import("./messages/om/public-content.json")).default,
  },
  so: {
    common: async () => (await import("./messages/so/common.json")).default,
    "public-content": async () =>
      (await import("./messages/so/public-content.json")).default,
  },
} satisfies Partial<Record<PublicLocale, OverlayLoaders>>;

export async function loadCatalog<Name extends CatalogName>(
  locale: PublicLocale,
  name: Name,
): Promise<CatalogMap[Name]> {
  if ((translatedInterfaceLocales as readonly string[]).includes(locale)) {
    return catalogLoaders[locale as TranslatedInterfaceLocale][
      name
    ]() as Promise<CatalogMap[Name]>;
  }

  // Every other public locale reads the English base and overlays any
  // locale-specific chrome it has translated.
  const base = (await catalogLoaders.en[name]()) as CatalogMap[Name];
  const overlay = (overlayLoaders as Record<string, OverlayLoaders>)[locale]?.[
    name
  ];
  if (!overlay) return base;
  return { ...base, ...(await overlay()) };
}

export async function loadPageCatalog<Name extends PageCatalogName>(
  locale: PublicLocale,
  name: Name,
): Promise<PageCatalog<Name>> {
  const [common, page] = await Promise.all([
    loadCatalog(locale, "common"),
    loadCatalog(locale, name),
  ]);
  return { ...common, ...page };
}
