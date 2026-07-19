import type { Locale } from "./index";

export interface CatalogMap {
  "auth-delivery": typeof import("./messages/en/auth-delivery.json");
  common: typeof import("./messages/en/common.json");
  "dashboard-layout": typeof import("./messages/en/dashboard-layout.json");
  "dashboard-places": typeof import("./messages/en/dashboard-places.json");
  home: typeof import("./messages/en/home.json");
  login: typeof import("./messages/en/login.json");
  "login-check": typeof import("./messages/en/login-check.json");
  "login-error": typeof import("./messages/en/login-error.json");
  "login-verify": typeof import("./messages/en/login-verify.json");
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
    "dashboard-layout": async () =>
      (await import("./messages/fr/dashboard-layout.json")).default,
    "dashboard-places": async () =>
      (await import("./messages/fr/dashboard-places.json")).default,
    home: async () => (await import("./messages/fr/home.json")).default,
    login: async () => (await import("./messages/fr/login.json")).default,
    "login-check": async () =>
      (await import("./messages/fr/login-check.json")).default,
    "login-error": async () =>
      (await import("./messages/fr/login-error.json")).default,
    "login-verify": async () =>
      (await import("./messages/fr/login-verify.json")).default,
  },
  en: {
    "auth-delivery": async () =>
      (await import("./messages/en/auth-delivery.json")).default,
    common: async () => (await import("./messages/en/common.json")).default,
    "dashboard-layout": async () =>
      (await import("./messages/en/dashboard-layout.json")).default,
    "dashboard-places": async () =>
      (await import("./messages/en/dashboard-places.json")).default,
    home: async () => (await import("./messages/en/home.json")).default,
    login: async () => (await import("./messages/en/login.json")).default,
    "login-check": async () =>
      (await import("./messages/en/login-check.json")).default,
    "login-error": async () =>
      (await import("./messages/en/login-error.json")).default,
    "login-verify": async () =>
      (await import("./messages/en/login-verify.json")).default,
  },
  ar: {
    "auth-delivery": async () =>
      (await import("./messages/ar/auth-delivery.json")).default,
    common: async () => (await import("./messages/ar/common.json")).default,
    "dashboard-layout": async () =>
      (await import("./messages/ar/dashboard-layout.json")).default,
    "dashboard-places": async () =>
      (await import("./messages/ar/dashboard-places.json")).default,
    home: async () => (await import("./messages/ar/home.json")).default,
    login: async () => (await import("./messages/ar/login.json")).default,
    "login-check": async () =>
      (await import("./messages/ar/login-check.json")).default,
    "login-error": async () =>
      (await import("./messages/ar/login-error.json")).default,
    "login-verify": async () =>
      (await import("./messages/ar/login-verify.json")).default,
  },
} satisfies Record<Locale, LocaleCatalogLoaders>;

export async function loadCatalog<Name extends CatalogName>(
  locale: Locale,
  name: Name,
): Promise<CatalogMap[Name]> {
  return catalogLoaders[locale][name]() as Promise<CatalogMap[Name]>;
}

export async function loadPageCatalog<Name extends PageCatalogName>(
  locale: Locale,
  name: Name,
): Promise<PageCatalog<Name>> {
  const [common, page] = await Promise.all([
    loadCatalog(locale, "common"),
    loadCatalog(locale, name),
  ]);
  return { ...common, ...page };
}
