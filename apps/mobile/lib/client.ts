import { createPublicClient } from "@infokit/api-client";
import { resolvePublicLocale, type PublicLocale } from "@infokit/shared/i18n";
import { Platform } from "react-native";

/**
 * Where the app reads the platform. A build points at its own web app through
 * `EXPO_PUBLIC_INFOKIT_API_URL` (Expo inlines `EXPO_PUBLIC_*` at bundle time);
 * without it, a dev build talks to the local Next server — which the Android
 * emulator reaches on its host alias, not on localhost.
 */
const fallbackBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3030" : "http://localhost:3030";

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_INFOKIT_API_URL ?? fallbackBaseUrl;

export const publicClient = createPublicClient({ baseUrl: apiBaseUrl });

/**
 * The reader's language, from the device. Hermes resolves the system locale
 * through Intl, so this needs no extra native module; unknown languages fall
 * back to French the same way the web routes do.
 */
export function deviceLocale(): PublicLocale {
  try {
    return resolvePublicLocale(
      new Intl.DateTimeFormat().resolvedOptions().locale,
    );
  } catch {
    return "fr";
  }
}

/**
 * The only strings the app owns. Everything a reader sees about content comes
 * from the server already localized — but these appear *before* any payload
 * exists (while loading, or when the request failed), so they cannot come from
 * one. Languages beyond fr/en/ar read English, exactly like the web catalogue.
 */
export interface ConnectionStrings {
  loading: string;
  failedTitle: string;
  failedBody: string;
  offlineBody: string;
  retry: string;
  back: string;
  notFound: string;
}

const englishConnectionStrings: ConnectionStrings = {
  loading: "Loading the published information…",
  failedTitle: "Information not loaded",
  failedBody: "The service answered with an error. Try again in a moment.",
  offlineBody:
    "Your phone could not reach the service. Check the connection and try again.",
  retry: "Try again",
  back: "Back",
  notFound: "This activity is no longer published.",
};

const translatedConnectionStrings: Partial<
  Record<PublicLocale, ConnectionStrings>
> = {
  fr: {
    loading: "Chargement des informations publiées…",
    failedTitle: "Informations non chargées",
    failedBody:
      "Le service a répondu par une erreur. Réessayez dans un moment.",
    offlineBody:
      "Votre téléphone n’a pas pu joindre le service. Vérifiez la connexion et réessayez.",
    retry: "Réessayer",
    back: "Retour",
    notFound: "Cette activité n’est plus publiée.",
  },
  ar: {
    loading: "جارٍ تحميل المعلومات المنشورة…",
    failedTitle: "لم يتم تحميل المعلومات",
    failedBody: "استجابت الخدمة بخطأ. أعد المحاولة بعد قليل.",
    offlineBody:
      "لم يتمكن هاتفك من الوصول إلى الخدمة. تحقق من الاتصال وأعد المحاولة.",
    retry: "إعادة المحاولة",
    back: "رجوع",
    notFound: "لم يعد هذا النشاط منشورًا.",
  },
};

export function connectionStrings(locale: PublicLocale): ConnectionStrings {
  return translatedConnectionStrings[locale] ?? englishConnectionStrings;
}
