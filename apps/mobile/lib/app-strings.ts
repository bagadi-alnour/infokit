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
  mapStyle: string;
  mapMuted: string;
  mapHybrid: string;

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

  // The members' door: the app signs in for itself now.
  emailLabel: string;
  passwordLabel: string;
  signInSubmit: string;
  magicLinkSubmit: string;
  magicLinkSent: string;
  invalidCredentials: string;

  // The second factor, when a sign-in stops to ask for one.
  twoFactorTitle: string;
  twoFactorBody: string;
  twoFactorTotpLabel: string;
  twoFactorSmsLabel: string;
  twoFactorSendSms: string;
  twoFactorBackupLabel: string;
  twoFactorSubmit: string;
  twoFactorUseBackup: string;
  twoFactorUseCode: string;
  twoFactorCancel: string;
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
  mapStyle: "Map style",
  mapMuted: "Muted",
  mapHybrid: "Hybrid",

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

  emailLabel: "Email address",
  passwordLabel: "Password",
  signInSubmit: "Sign in",
  magicLinkSubmit: "Email me a sign-in link",
  magicLinkSent:
    "If that address has an account, a sign-in link is on its way. The link works once and expires after 15 minutes.",
  invalidCredentials:
    "That email address and password do not match an account.",

  twoFactorTitle: "Confirm it is you",
  twoFactorBody:
    "Your password was accepted. One more proof is needed before the session opens.",
  twoFactorTotpLabel: "Code from your authenticator app",
  twoFactorSmsLabel: "Code received by SMS",
  twoFactorSendSms: "Send a code by SMS",
  twoFactorBackupLabel: "Backup code",
  twoFactorSubmit: "Confirm and continue",
  twoFactorUseBackup: "Use a backup code instead",
  twoFactorUseCode: "Use a six-digit code instead",
  twoFactorCancel: "Cancel and start again",
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
    mapStyle: "Fond de carte",
    mapMuted: "Atténué",
    mapHybrid: "Hybride",

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

    emailLabel: "Adresse e-mail",
    passwordLabel: "Mot de passe",
    signInSubmit: "Se connecter",
    magicLinkSubmit: "M’envoyer un lien de connexion",
    magicLinkSent:
      "Si un compte existe pour cette adresse, un lien de connexion est en route. Il ne fonctionne qu’une fois et expire après 15 minutes.",
    invalidCredentials:
      "Cette adresse e-mail et ce mot de passe ne correspondent à aucun compte.",

    twoFactorTitle: "Confirmez votre identité",
    twoFactorBody:
      "Votre mot de passe a été accepté. Il reste une preuve à apporter avant d’ouvrir la session.",
    twoFactorTotpLabel: "Code de votre application d’authentification",
    twoFactorSmsLabel: "Code reçu par SMS",
    twoFactorSendSms: "Envoyer un code par SMS",
    twoFactorBackupLabel: "Code de secours",
    twoFactorSubmit: "Confirmer et continuer",
    twoFactorUseBackup: "Utiliser un code de secours à la place",
    twoFactorUseCode: "Utiliser un code à six chiffres à la place",
    twoFactorCancel: "Annuler et recommencer",
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
    mapStyle: "نمط الخريطة",
    mapMuted: "هادئة",
    mapHybrid: "هجين",

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

    emailLabel: "عنوان البريد الإلكتروني",
    passwordLabel: "كلمة المرور",
    signInSubmit: "تسجيل الدخول",
    magicLinkSubmit: "أرسل لي رابط تسجيل الدخول",
    magicLinkSent:
      "إذا كان لهذا العنوان حساب، فإن رابط تسجيل الدخول في الطريق. يعمل الرابط مرة واحدة وتنتهي صلاحيته بعد 15 دقيقة.",
    invalidCredentials:
      "عنوان البريد الإلكتروني وكلمة المرور لا يطابقان أي حساب.",

    twoFactorTitle: "أكد أنك أنت",
    twoFactorBody:
      "قُبلت كلمة مرورك. تبقى خطوة إثبات واحدة قبل أن تُفتح الجلسة.",
    twoFactorTotpLabel: "الرمز من تطبيق المصادقة",
    twoFactorSmsLabel: "الرمز الوارد برسالة نصية",
    twoFactorSendSms: "إرسال رمز برسالة نصية",
    twoFactorBackupLabel: "رمز احتياطي",
    twoFactorSubmit: "تأكيد ومتابعة",
    twoFactorUseBackup: "استخدام رمز احتياطي بدلًا من ذلك",
    twoFactorUseCode: "استخدام رمز من ستة أرقام بدلًا من ذلك",
    twoFactorCancel: "إلغاء والبدء من جديد",
  },
};

export function appStrings(locale: PublicLocale): AppStrings {
  return translated[locale] ?? english;
}
