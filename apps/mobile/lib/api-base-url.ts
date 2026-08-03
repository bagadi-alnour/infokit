import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Where the app reads the platform. A build points at its own web app through
 * `EXPO_PUBLIC_INFOKIT_API_URL` (Expo inlines `EXPO_PUBLIC_*` at bundle time);
 * without it, a dev build talks to the local Next server — which the Android
 * emulator reaches on its host alias, not on localhost.
 *
 * This sits in its own module because both the content clients and the auth
 * client need it, and the auth client is what the content clients get their
 * session headers from. Leaving it in `./client` made those two import each
 * other.
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
