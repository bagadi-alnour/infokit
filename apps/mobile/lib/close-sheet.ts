import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Closes a sheet, and knows what to do when there is nothing behind it.
 *
 * A sheet is normally opened from a screen, so going back is the answer. But a
 * sheet can also be the app's first screen — a link to the members' door shared
 * in a message, or a hard reload of `/language` in the browser build — and then
 * there is no history to pop: the close button would do nothing at all. Landing
 * on "Now" is the honest fallback, since it is where the reader would have come
 * from.
 */
export function closeSheet(router: Router) {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
