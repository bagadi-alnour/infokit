import { createMemberClient, createPublicClient } from "@infokit/api-client";
import { resolvePublicLocale, type PublicLocale } from "@infokit/shared/i18n";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { readStored } from "./store";

/**
 * Where the app reads the platform. A build points at its own web app through
 * `EXPO_PUBLIC_INFOKIT_API_URL` (Expo inlines `EXPO_PUBLIC_*` at bundle time);
 * without it, a dev build talks to the local Next server — which the Android
 * emulator reaches on its host alias, not on localhost.
 */
const fallbackBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3030" : "http://localhost:3030";

/**
 * A loopback URL means "this machine", and on a phone this machine is the phone.
 * Expo Go knows the host it fetched the bundle from, so in development that host
 * is the one this laptop is genuinely reachable on — better than any address
 * worked out when the dev server started, and it survives changing networks.
 * Anything pointing somewhere real (staging, production) is left alone.
 */
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_INFOKIT_API_URL ?? fallbackBaseUrl;
  if (
    !/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/.test(configured)
  )
    return configured;

  // `hostUri` is how the bundle got here: "192.168.1.24:8081" on a LAN, the
  // tunnel host through a tunnel, absent in a released build.
  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri !== "string") return configured;
  const host = hostUri.replace(/^\w+:\/\//, "").split(/[:/]/)[0];
  if (!host || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host))
    return configured;

  // Host only: the port and the path belong to the web app, not to Metro.
  return configured.replace(/^(https?:\/\/)[^/:]+/, `$1${host}`);
}

export const apiBaseUrl = resolveApiBaseUrl();

export const publicClient = createPublicClient({ baseUrl: apiBaseUrl });

/**
 * The members' reader. It takes the token from the keychain on every call
 * rather than holding one, so signing out anywhere in the app takes effect on
 * the next request without a provider having to pass the token around.
 */
export const memberClient = createMemberClient({
  baseUrl: apiBaseUrl,
  token: () => readStored("token"),
});

/**
 * The ordinary web sign-in, told to finish on the hand-off page. The app has no
 * sign-in of its own: the email link and the SMS step-up happen in the system
 * browser, on the site, under the same allowlist as the editor console.
 */
export function signInUrl(locale: PublicLocale): string {
  const handoff = `/${locale}/login/device`;
  return `${apiBaseUrl}/${locale}/login?returnTo=${encodeURIComponent(handoff)}`;
}

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
