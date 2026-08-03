import { MemberSignedOutError } from "@infokit/api-client";
import type {
  MemberDoorLabels,
  MemberIdentityPayload,
} from "@infokit/shared/public-content";
import * as Linking from "expo-linking";
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

import { apiBaseUrl } from "./api-base-url";
import { authClient } from "./auth-client";
import { memberClient } from "./client";
import { usePreferences } from "./preferences";

/**
 * Whether anyone is signed in on this device, and the way in and out.
 *
 * There are two questions here, and keeping them apart is what this provider is
 * for. Better Auth owns *whether there is a session* — `authClient` holds it in
 * the keychain and re-reads it across launches. This platform's own member
 * endpoint owns *what that person may see*: their name, their organisations, the
 * words on the members' door. So the session is the trigger and the member
 * payload is the content, and a sign-in is not finished until both have arrived.
 *
 * The nine-digit code typed from one screen into another is gone. Password and
 * second factor happen in the app now. A magic link still cannot: it is verified
 * wherever it is opened, so the browser hands the finished session back as a
 * one-time token on `infokit://sign-in?token=…`, which `consumeHandoffToken`
 * trades for this device's own session. Better Auth owns that token's expiry and
 * its single use — the part a bespoke table used to do by hand.
 */
export type SessionState =
  | { status: "loading" }
  | { status: "signedIn"; identity: MemberIdentityPayload }
  | { status: "signedOut"; door: MemberDoorLabels | null; notice: Notice };

/** What to say about the last attempt, in the door's own words. */
export type Notice = "none" | "failed" | "invalidCredentials" | "offline";

/** A sign-in that stopped to ask for a second factor, and how it may answer. */
export interface PendingSecondFactor {
  /** True when an authenticator app is enrolled on the account. */
  totp: boolean;
  /** True when a code can be sent by SMS. */
  otp: boolean;
}

export type SecondFactorKind = "totp" | "otp" | "backup";

interface SessionValue {
  state: SessionState;
  /** True while a sign-in, a code check or a sign-out is in flight. */
  busy: boolean;
  /** Set when the password was accepted but a second factor is still owed. */
  pendingSecondFactor: PendingSecondFactor | null;
  signIn: (input: {
    email: string;
    password: string;
  }) => Promise<"signedIn" | "secondFactor" | "failed">;
  sendMagicLink: (email: string) => Promise<boolean>;
  sendSmsCode: () => Promise<boolean>;
  submitSecondFactor: (
    kind: SecondFactorKind,
    code: string,
  ) => Promise<boolean>;
  cancelSecondFactor: () => void;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingSecondFactor, setPendingSecondFactor] =
    useState<PendingSecondFactor | null>(null);
  // A ref, not state: the notice is set alongside the reload meant to display
  // it, so making it a dependency of `load` would reload again for every message.
  const notice = useRef<Notice>("none");
  // A hand-off token is single-use, and a cold start can surface the same link
  // twice — once as the launch URL, once through the listener. The second
  // attempt would fail for no reason the reader could act on.
  const consumed = useRef<Set<string>>(new Set());
  const incomingUrl = Linking.useLinkingURL();

  const refresh = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  /**
   * Ask the platform who is reading. This is the only thing that moves the
   * provider into `signedIn`: a Better Auth session the member endpoint does not
   * recognise is not something to show member content for.
   */
  const load = useCallback(async () => {
    try {
      const payload = await memberClient.session({ locale });
      if (payload.signedIn) {
        notice.current = "none";
        setPendingSecondFactor(null);
        setState({ status: "signedIn", identity: payload });
        return;
      }
      setState({
        status: "signedOut",
        door: payload.door,
        notice: notice.current,
      });
    } catch {
      // The door's words live on the server, so an unreachable service means the
      // members' row shows nothing at all rather than an untranslated stub.
      setState({ status: "signedOut", door: null, notice: notice.current });
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setBusy(true);
      try {
        const { data, error } = await authClient.signIn.email({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) {
          // Better Auth answers an unknown address and a wrong password
          // identically, on purpose, and so does this screen.
          notice.current = "invalidCredentials";
          refresh();
          return "failed" as const;
        }
        const outcome = data as {
          twoFactorRedirect?: boolean;
          twoFactorMethods?: string[];
        } | null;
        if (outcome?.twoFactorRedirect) {
          const methods = outcome.twoFactorMethods ?? [];
          setPendingSecondFactor({
            totp: methods.includes("totp"),
            // With nothing listed, offer the SMS: it is the channel every
            // account holding a number can use.
            otp: methods.length === 0 || methods.includes("otp"),
          });
          notice.current = "none";
          return "secondFactor" as const;
        }
        notice.current = "none";
        refresh();
        return "signedIn" as const;
      } catch {
        notice.current = "offline";
        refresh();
        return "failed" as const;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  /**
   * The other way in, and the one most people here use: a link by email. The
   * link finishes the sign-in wherever it is opened, so nothing comes back into
   * this provider — the screen's job is to say to go and read the message.
   */
  const sendMagicLink = useCallback(
    async (email: string) => {
      setBusy(true);
      try {
        const { error } = await authClient.signIn.magicLink({
          email: email.trim().toLowerCase(),
          /**
           * A web page, deliberately — not `infokit://`. The link is verified
           * wherever it is opened, and Better Auth puts the session cookie in
           * that browser's jar where this app cannot read it. The hand-off page
           * turns it into a one-time token and deep-links that back here.
           */
          callbackURL: `${apiBaseUrl}/${locale}/login/device`,
        });
        return !error;
      } catch {
        notice.current = "offline";
        return false;
      } finally {
        setBusy(false);
      }
    },
    [locale],
  );

  /**
   * Trade a hand-off token for this device's session.
   *
   * Called through `authClient`, not a bare fetch, and that is the whole point:
   * the verify endpoint answers with a `set-cookie`, and it is `expoClient`'s
   * fetch hook that writes it into the keychain. A plain fetch would succeed and
   * store nothing.
   */
  const consumeHandoff = useCallback(
    async (token: string) => {
      if (consumed.current.has(token)) return;
      consumed.current.add(token);
      setBusy(true);
      try {
        const { error } = await authClient.oneTimeToken.verify({ token });
        notice.current = error ? "failed" : "none";
      } catch {
        notice.current = "offline";
      } finally {
        setBusy(false);
        refresh();
      }
    },
    [refresh],
  );

  // A link that arrives while the app is open, or that launched it.
  useEffect(() => {
    if (!incomingUrl) return;
    try {
      const token = Linking.parse(incomingUrl).queryParams?.token;
      if (typeof token === "string" && token.trim()) {
        void consumeHandoff(token.trim());
      }
    } catch {
      // Not a link this app has anything to do with.
    }
  }, [incomingUrl, consumeHandoff]);

  const sendSmsCode = useCallback(async () => {
    setBusy(true);
    try {
      const { error } = await authClient.twoFactor.sendOtp();
      return !error;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const submitSecondFactor = useCallback(
    async (kind: SecondFactorKind, code: string) => {
      setBusy(true);
      try {
        const value = code.trim();
        const { error } =
          kind === "totp"
            ? await authClient.twoFactor.verifyTotp({ code: value })
            : kind === "otp"
              ? await authClient.twoFactor.verifyOtp({ code: value })
              : await authClient.twoFactor.verifyBackupCode({ code: value });
        if (error) {
          notice.current = "invalidCredentials";
          return false;
        }
        setPendingSecondFactor(null);
        notice.current = "none";
        refresh();
        return true;
      } catch {
        notice.current = "offline";
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  /** Abandon a half-finished sign-in and go back to the door. */
  const cancelSecondFactor = useCallback(() => {
    setPendingSecondFactor(null);
    notice.current = "none";
    void authClient.signOut().catch(() => undefined);
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      // Two calls, because they end two different things: the platform's member
      // endpoint stops trusting this device, and Better Auth clears the session
      // it keeps in the keychain.
      await memberClient.signOut();
    } catch (cause) {
      // A phone that cannot reach the service must still be able to stop showing
      // member content, so the local session goes whatever the server said.
      if (!(cause instanceof MemberSignedOutError)) {
        console.warn("member sign-out did not reach the server", cause);
      }
    } finally {
      await authClient.signOut().catch(() => undefined);
      setPendingSecondFactor(null);
      // Forget spent hand-off tokens too: the next sign-in mints new ones, and
      // keeping the set would grow for the life of the process.
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
      pendingSecondFactor,
      signIn,
      sendMagicLink,
      sendSmsCode,
      submitSecondFactor,
      cancelSecondFactor,
      signOut,
      refresh,
    }),
    [
      state,
      busy,
      pendingSecondFactor,
      signIn,
      sendMagicLink,
      sendSmsCode,
      submitSecondFactor,
      cancelSecondFactor,
      signOut,
      refresh,
    ],
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
  labels: { invalidCredentials: string; offline: string },
): string | null {
  if (notice === "none") return null;
  if (notice === "invalidCredentials") return labels.invalidCredentials;
  if (notice === "offline") return labels.offline;
  return door?.signInFailed ?? null;
}
