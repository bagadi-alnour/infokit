import { createMemberClient, createPublicClient } from "@infokit/api-client";
import { resolvePublicLocale, type PublicLocale } from "@infokit/shared/i18n";

import { apiBaseUrl } from "./api-base-url";
import { memberAuthHeaders } from "./auth-client";

export { apiBaseUrl };

export const publicClient = createPublicClient({ baseUrl: apiBaseUrl });

/**
 * The members' reader. It asks the auth client for the session on every call
 * rather than holding one, so signing out anywhere in the app takes effect on
 * the next request without a provider having to pass a token around.
 */
export const memberClient = createMemberClient({
  baseUrl: apiBaseUrl,
  authHeaders: memberAuthHeaders,
});

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
