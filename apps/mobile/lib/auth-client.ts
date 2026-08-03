import { expoClient } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import {
  magicLinkClient,
  oneTimeTokenClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { apiBaseUrl } from "./api-base-url";

/**
 * The app's own sign-in.
 *
 * It used to have none: the phone opened the website's sign-in in the system
 * browser, the browser minted a nine-digit hand-off code, and the app traded
 * that for a token from a bespoke table. One sign-in existed, and it was the
 * web's.
 *
 * There is still one sign-in — it is just that Better Auth is now on both sides
 * of it. The app talks to the same endpoints the console does, under the same
 * invitation-only gate, with the same second factor; what it no longer does is
 * borrow a browser's session through a code read off one screen and typed into
 * another.
 *
 * The session lives in the platform keychain via `expoClient`'s storage, which
 * is the same keychain `./store` uses for preferences. Better Auth manages those
 * entries itself, so nothing here reads or writes them by hand.
 */

/**
 * `expoClient`'s declared type does not satisfy `BetterAuthClientPlugin` under
 * `strictFunctionTypes`, and the reason is upstream: it types its `getActions`
 * first parameter as `BetterFetch<CreateFetchOption, unknown, unknown, Schema |
 * undefined>`, while the constraint in `@better-auth/core` uses a bare
 * `BetterFetch` whose defaults are not those. Parameters are checked
 * contravariantly, so two spellings of "the fetcher" make the whole plugin
 * unassignable — nothing about the runtime differs.
 *
 * Repaired at that one member rather than replaced wholesale. `Omit` keeps
 * everything else the real plugin declares — its `id`, its `fetchPlugins` — so
 * Better Auth can still read the shape it infers the client's methods from; only
 * `getActions` is restated, with the parameters the constraint asks for and the
 * one action the plugin actually contributes.
 *
 * A blanket cast or a `@ts-expect-error` both cost more than they fix here: each
 * degrades the plugin list enough that `createAuthClient` falls back to its base
 * options, taking `twoFactor`, `signIn.magicLink` and even `signOut` with it.
 */
type ExpoClientPlugin = Omit<ReturnType<typeof expoClient>, "getActions"> & {
  getActions: (
    ...args: Parameters<NonNullable<BetterAuthClientPlugin["getActions"]>>
  ) => { getCookie: () => string };
};

/**
 * Annotated as a tuple on purpose: `createAuthClient` reads each plugin's own
 * type to build the client's methods, and an inferred array would widen these
 * three into one union and lose all of them.
 */
const plugins: [
  ExpoClientPlugin,
  ReturnType<typeof magicLinkClient>,
  ReturnType<typeof oneTimeTokenClient>,
  ReturnType<typeof twoFactorClient>,
] = [
  expoClient({
    scheme: "infokit",
    storagePrefix: "infokit",
    storage: SecureStore,
  }) as unknown as ExpoClientPlugin,
  /** The way in that needs no password, and the one most people here use. */
  magicLinkClient(),
  /**
   * How that way in actually finishes here. A magic link is verified wherever it
   * is opened — the system browser — and the session cookie lands in *that* jar,
   * out of this app's reach. The browser hands it over as a one-time token
   * instead, and this is what trades the token for the session. See
   * `consumeHandoffToken` in `./session`.
   */
  oneTimeTokenClient(),
  /**
   * Sign-in can be interrupted by a second factor, and the app has to be able to
   * finish it: this is what gives it `twoFactor.verifyTotp`,
   * `twoFactor.sendOtp` and `twoFactor.verifyBackupCode`.
   */
  twoFactorClient(),
];

export const authClient = createAuthClient({ baseURL: apiBaseUrl, plugins });

/**
 * The headers that carry the session on a call to this platform's own member
 * endpoints.
 *
 * Better Auth keeps the session as a cookie string in the keychain, and React
 * Native has no cookie jar to send it from, so it travels as an explicit header.
 * Null means nobody is signed in on this device — which the member client turns
 * into `MemberSignedOutError` rather than a request nobody can answer.
 */
export function memberAuthHeaders(): Record<string, string> | null {
  const cookie = authClient.getCookie();
  return cookie ? { cookie } : null;
}
