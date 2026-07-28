import { MemberSignedOutError, PublicApiError } from "@infokit/api-client";
import type {
  MemberDoorLabels,
  MemberIdentityPayload,
} from "@infokit/shared/public-content";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { memberClient, signInUrl } from "./client";
import { usePreferences } from "./preferences";
import { clearStored, writeStored } from "./store";

/**
 * Whether anyone is signed in on this device, and the way in and out.
 *
 * There is no second sign-in here: `signIn` opens the site's own sign-in in the
 * system browser, which already knows the allowlist, the email link and the SMS
 * step-up. What comes back is a one-time code — by deep link when the link
 * fires, typed by hand when it does not — which this provider trades for a
 * session token. The token is the only thing kept on the phone, and deleting it
 * is not enough on its own: signing out revokes the session on the server too.
 */
export type SessionState =
  | { status: "loading" }
  | { status: "signedIn"; identity: MemberIdentityPayload }
  | { status: "signedOut"; door: MemberDoorLabels | null; notice: Notice };

/** What to say about the last attempt, in the door's own words. */
export type Notice = "none" | "cancelled" | "failed" | "invalidCode";

interface SessionValue {
  state: SessionState;
  /** True while a browser hand-off or a code exchange is in flight. */
  busy: boolean;
  signIn: () => Promise<void>;
  submitCode: (code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** The code carried by `infokit://sign-in?code=…`, or null for any other link. */
function codeFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const code = parsed.queryParams?.code;
    return typeof code === "string" && code.trim() ? code.trim() : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const notice = useRef<Notice>("none");
  // A code is single-use: the browser result and the deep-link listener can
  // both see the same one, and the second exchange would fail for no reason.
  const consumed = useRef<Set<string>>(new Set());
  const incomingUrl = Linking.useLinkingURL();

  const load = useCallback(async () => {
    try {
      const payload = await memberClient.session({ locale });
      if (payload.signedIn) {
        notice.current = "none";
        setState({ status: "signedIn", identity: payload });
        return;
      }
      setState({
        status: "signedOut",
        door: payload.door,
        notice: notice.current,
      });
    } catch {
      // The door's words live on the server, so an unreachable server means the
      // members' row shows nothing at all rather than an untranslated stub.
      setState({ status: "signedOut", door: null, notice: notice.current });
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  const refresh = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  const exchange = useCallback(
    async (code: string): Promise<boolean> => {
      if (consumed.current.has(code)) return true;
      consumed.current.add(code);
      setBusy(true);
      try {
        const session = await memberClient.exchange(code);
        await writeStored("token", session.token);
        notice.current = "none";
        refresh();
        return true;
      } catch (cause) {
        notice.current =
          cause instanceof PublicApiError && cause.status === 400
            ? "invalidCode"
            : "failed";
        refresh();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  // A link that arrives while the app is already open (or that started it).
  useEffect(() => {
    const code = codeFromUrl(incomingUrl);
    if (code) void exchange(code);
  }, [incomingUrl, exchange]);

  const signIn = useCallback(async () => {
    setBusy(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        signInUrl(locale),
        Linking.createURL("/sign-in"),
      );
      if (result.type === "success") {
        const code = codeFromUrl(result.url);
        if (code) {
          await exchange(code);
          return;
        }
        notice.current = "failed";
      } else if (
        result.type === WebBrowser.WebBrowserResultType.CANCEL ||
        result.type === WebBrowser.WebBrowserResultType.DISMISS
      ) {
        // Closing the browser is a decision, not a failure: say so plainly and
        // leave everything as it was.
        notice.current = "cancelled";
      }
      refresh();
    } finally {
      setBusy(false);
    }
  }, [locale, exchange, refresh]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await memberClient.signOut();
    } catch (cause) {
      if (!(cause instanceof MemberSignedOutError)) throw cause;
    } finally {
      // The token goes whatever the server said: a phone that cannot reach the
      // service must still be able to stop showing member content.
      await clearStored("token");
      consumed.current.clear();
      notice.current = "none";
      setBusy(false);
      refresh();
    }
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      busy,
      signIn,
      submitCode: exchange,
      signOut,
      refresh,
    }),
    [state, busy, signIn, exchange, signOut, refresh],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession needs SessionProvider above.");
  return value;
}

/** The notice for the last attempt, in the door's words, or null for none. */
export function noticeText(
  notice: Notice,
  door: MemberDoorLabels | null,
  invalidCode: string,
): string | null {
  if (notice === "none") return null;
  if (notice === "invalidCode") return invalidCode;
  if (!door) return null;
  return notice === "cancelled" ? door.signInCancelled : door.signInFailed;
}
