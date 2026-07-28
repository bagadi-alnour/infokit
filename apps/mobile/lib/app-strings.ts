import type { PublicLocale } from "@infokit/shared/i18n";

/**
 * The only strings the app owns.
 *
 * Everything a reader sees *about content* arrives from the server already
 * localized. These do not: they are the app's own furniture — tab labels, the
 * words shown while nothing has loaded, the failure notices — and they appear
 * before any payload exists, so they cannot come from one.
 *
 * fr/en/ar are translated, exactly like the web catalogues; every other public
 * locale reads the English set rather than blanking (see `catalogs.ts`).
 */
export interface AppStrings {
  // Waiting, and not arriving.
  loading: string;
  failedTitle: string;
  failedBody: string;
  offlineBody: string;
  retry: string;
  back: string;
  notFound: string;

  // The tab bar, in the order it is read.
  tabHome: string;
  tabNow: string;
  tabMap: string;
  tabGuide: string;
  tabArticles: string;

  // The header.
  language: string;
  languageTitle: string;
  theme: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  members: string;
  close: string;

  // Now.
  openNow: string;
  openNowEmpty: string;
  nextUp: string;
  latest: string;
  seeAll: string;

  // Events.
  eventsPublic: string;
  eventsMembers: string;

  // The typed fallback when the deep link does not fire.
  codeLabel: string;
  codeHint: string;
  codeSubmit: string;
  codeInvalid: string;
}

const english: AppStrings = {
  loading: "Loading the published information…",
  failedTitle: "Information not loaded",
  failedBody: "The service answered with an error. Try again in a moment.",
  offlineBody:
    "Your phone could not reach the service. Check the connection and try again.",
  retry: "Try again",
  back: "Back",
  notFound: "This page is no longer published.",

  tabHome: "Home",
  tabNow: "Now",
  tabMap: "Map",
  tabGuide: "Guide",
  tabArticles: "Articles",

  language: "Language",
  languageTitle: "Choose a language",
  theme: "Appearance",
  themeSystem: "Match the phone",
  themeLight: "Light",
  themeDark: "Dark",
  members: "Members",
  close: "Close",

  openNow: "Open now",
  openNowEmpty: "Nothing is open at this hour.",
  nextUp: "Next",
  latest: "Latest",
  seeAll: "See all",

  eventsPublic: "Open to everyone",
  eventsMembers: "For members",

  codeLabel: "Sign-in code",
  codeHint: "Nine digits, from the page in your browser.",
  codeSubmit: "Finish signing in",
  codeInvalid: "That code is not valid any more. Ask for a new one.",
};

const translated: Partial<Record<PublicLocale, AppStrings>> = {
  fr: {
    loading: "Chargement des informations publiées…",
    failedTitle: "Informations non chargées",
    failedBody:
      "Le service a répondu par une erreur. Réessayez dans un moment.",
    offlineBody:
      "Votre téléphone n’a pas pu joindre le service. Vérifiez la connexion et réessayez.",
    retry: "Réessayer",
    back: "Retour",
    notFound: "Cette page n’est plus publiée.",

    tabHome: "Accueil",
    tabNow: "Maintenant",
    tabMap: "Carte",
    tabGuide: "Guide",
    tabArticles: "Articles",

    language: "Langue",
    languageTitle: "Choisir une langue",
    theme: "Apparence",
    themeSystem: "Comme le téléphone",
    themeLight: "Clair",
    themeDark: "Sombre",
    members: "Membres",
    close: "Fermer",

    openNow: "Ouvert maintenant",
    openNowEmpty: "Rien n’est ouvert à cette heure.",
    nextUp: "Prochainement",
    latest: "Dernières informations",
    seeAll: "Tout voir",

    eventsPublic: "Ouvert à tous",
    eventsMembers: "Pour les membres",

    codeLabel: "Code de connexion",
    codeHint: "Neuf chiffres, depuis la page ouverte dans votre navigateur.",
    codeSubmit: "Terminer la connexion",
    codeInvalid: "Ce code n’est plus valable. Demandez-en un nouveau.",
  },
  ar: {
    loading: "جارٍ تحميل المعلومات المنشورة…",
    failedTitle: "لم يتم تحميل المعلومات",
    failedBody: "استجابت الخدمة بخطأ. أعد المحاولة بعد قليل.",
    offlineBody:
      "لم يتمكن هاتفك من الوصول إلى الخدمة. تحقق من الاتصال وأعد المحاولة.",
    retry: "إعادة المحاولة",
    back: "رجوع",
    notFound: "لم تعد هذه الصفحة منشورة.",

    tabHome: "الرئيسية",
    tabNow: "الآن",
    tabMap: "الخريطة",
    tabGuide: "الدليل",
    tabArticles: "المقالات",

    language: "اللغة",
    languageTitle: "اختر اللغة",
    theme: "المظهر",
    themeSystem: "مثل الهاتف",
    themeLight: "فاتح",
    themeDark: "غامق",
    members: "الأعضاء",
    close: "إغلاق",

    openNow: "مفتوح الآن",
    openNowEmpty: "لا يوجد ما هو مفتوح في هذه الساعة.",
    nextUp: "القادم",
    latest: "أحدث المعلومات",
    seeAll: "عرض الكل",

    eventsPublic: "مفتوح للجميع",
    eventsMembers: "للأعضاء",

    codeLabel: "رمز الدخول",
    codeHint: "تسعة أرقام، من الصفحة المفتوحة في متصفحك.",
    codeSubmit: "إتمام تسجيل الدخول",
    codeInvalid: "لم يعد هذا الرمز صالحًا. اطلب رمزًا جديدًا.",
  },
};

export function appStrings(locale: PublicLocale): AppStrings {
  return translated[locale] ?? english;
}
