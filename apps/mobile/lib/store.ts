import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * The one place this app keeps anything between launches.
 *
 * On a device it is the platform keychain, because one of the values is a
 * session token; the preferences ride along rather than adding a second
 * store. On web (Expo's dev build) the keychain does not exist, so the same
 * keys fall back to `localStorage` — which is also why nothing sensitive
 * is ever assumed to be secret here: the token is short-lived and revocable
 * server-side either way.
 */
const keys = {
  token: "infokit.member.token",
  locale: "infokit.locale",
  theme: "infokit.theme",
  welcome: "infokit.welcome.seen",
} as const;

export type StoreKey = keyof typeof keys;

const web = Platform.OS === "web";

export async function readStored(key: StoreKey): Promise<string | null> {
  try {
    // `localStorage` can throw outright (private browsing, blocked storage);
    // the catch below turns that into "nothing stored", same as an empty slot.
    if (web) return globalThis.localStorage.getItem(keys[key]);
    return await SecureStore.getItemAsync(keys[key]);
  } catch {
    // A locked or unavailable keychain reads as "nothing stored": the app then
    // behaves like a fresh install instead of refusing to start.
    return null;
  }
}

export async function writeStored(key: StoreKey, value: string): Promise<void> {
  try {
    if (web) globalThis.localStorage.setItem(keys[key], value);
    else await SecureStore.setItemAsync(keys[key], value);
  } catch {
    // Preferences that cannot be saved are still applied for this session.
  }
}

export async function clearStored(key: StoreKey): Promise<void> {
  try {
    if (web) globalThis.localStorage.removeItem(keys[key]);
    else await SecureStore.deleteItemAsync(keys[key]);
  } catch {
    // Nothing to do: the next read failing is the same outcome.
  }
}
