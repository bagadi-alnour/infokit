import * as Linking from "expo-linking";
import { Platform } from "react-native";

/**
 * Where something is, in the three forms a phone might need it: the words the
 * reader saw, the point if the editor gave an exact one, and the site's own map
 * link as the last resort.
 */
export interface MapTarget {
  /** The address or place name as it is printed on the screen. */
  label: string;
  latitude: number | null;
  longitude: number | null;
  /** The public site's map link (OpenStreetMap), when there is one. */
  fallbackHref: string | null;
}

/** True when there is enough to open anything at all. */
export function hasMapTarget(target: MapTarget): boolean {
  if (target.fallbackHref !== null) return true;
  if (target.latitude !== null && target.longitude !== null) return true;
  return target.label.trim().length > 0;
}

function searchQuery(target: MapTarget): string {
  if (target.latitude !== null && target.longitude !== null) {
    return `${String(target.latitude)},${String(target.longitude)}`;
  }
  return target.label.trim();
}

/**
 * Hands the address to the phone's map application — Google Maps first, because
 * that is the one almost every Android handset already has and the one people
 * navigate with.
 *
 * The handoff is one-way: the app sends an address out and never asks the phone
 * where its owner is, so nothing about the reader's own position leaves the
 * device. iOS is asked whether Google Maps is installed (the scheme is declared
 * in app.json) and Android is simply handed a `geo:` address, which its own
 * chooser resolves; if either has nothing to answer with, the request falls back
 * to the web map, which every browser can open.
 */
export async function openMap(target: MapTarget): Promise<void> {
  const query = searchQuery(target);
  const web = query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : target.fallbackHref;

  if (query) {
    const native =
      Platform.OS === "ios"
        ? `comgooglemaps://?q=${encodeURIComponent(query)}`
        : Platform.OS === "android"
          ? `geo:0,0?q=${encodeURIComponent(query)}`
          : null;
    if (native && (await canOpen(native))) {
      if (await tryOpen(native)) return;
    }
  }

  if (web) await tryOpen(web);
}

/**
 * `canOpenURL` throws on some platforms rather than answering false, and on
 * Android it answers false for perfectly openable intents unless the scheme is
 * declared — so a "no" there is not taken as one.
 */
async function canOpen(url: string): Promise<boolean> {
  if (Platform.OS === "android") return true;
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

/** Opening a URL fails when nothing on the phone handles it; that is not an error. */
async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
