import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, like, lt } from "drizzle-orm";
import { cookies } from "next/headers";

import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import { trustedDevices, verificationTokens } from "~/server/db/schema";
import { describeDevice } from "./sessions";

/**
 * "Trust this device": the second factor, not asked for again on a browser its
 * owner has vouched for.
 *
 * The factor itself is unchanged — a code still has to be confirmed before trust
 * can be granted, and the trust is what the *next* sign-in reads. What this
 * module owns is the record of that decision, and it has two halves because
 * Better Auth's second factor is applied in two different ways.
 *
 * **Our row is the fact.** `auth.trusted_devices` holds one row per device, keyed
 * by the digest of a secret that lives only in that device's cookie. A session
 * created on a device holding a live row is stamped as having passed the factor
 * (`./second-factor-stamp`), which is the fact `requireEditor` already gates on.
 * This is what covers the emailed link — the usual way into this console, and a
 * path Better Auth does not intercept at all.
 *
 * **The library's marker is the shortcut.** On a *password* sign-in Better Auth
 * interrupts before any session exists, and nothing outside the library can
 * suppress that interception: its hook reads its own signed cookie off the
 * request, so a cookie we set in the same request is invisible to it. Passing
 * `trustDevice: true` to the verify endpoint is therefore the only way a trusted
 * device can skip the prompt on that path, and `trustDeviceGrant()` below asks
 * for it whenever the box is ticked.
 *
 * The two are granted together and revoked together, so they cannot drift into
 * disagreement about whether a device is trusted. If they do drift anyway — a
 * cookie cleared on one side, a row expired on the other — both directions fail
 * safe, because each one only ever *skips* a prompt and neither can grant a
 * session on its own:
 *
 * - Our row gone, the library's marker alive: the password sign-in is not
 *   interrupted, but the session it mints is not stamped, so `requireEditor`
 *   asks for a code as a step-up.
 * - Our row alive, the marker gone: the sign-in is interrupted and a code is
 *   asked for once, exactly as it was before this feature.
 */

/**
 * A fortnight, and the same number on both halves.
 *
 * Long enough that a working week does not begin with an SMS; short enough that
 * a laptop sold, lost or left behind stops being trusted without anybody having
 * to remember to say so. `twoFactor({ trustDeviceMaxAge })` in `./server` reads
 * this constant so the library's marker cannot outlive our row.
 */
export const trustedDeviceMaxAgeSeconds = 14 * 24 * 60 * 60;

/**
 * Not prefixed with `__Host-`, deliberately. The prefix would pin the cookie to
 * an exact origin, and this one has to survive a magic link opened from a mail
 * client — see the `sameSite` note in `grantTrustedDevice`.
 */
const trustedDeviceCookieName = "infokit.trusted_device";

/** Better Auth's own trust markers, told apart from every other row by prefix. */
const libraryTrustIdentifierPrefix = "trust-device-";

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The secret this browser is carrying, read from a raw `Cookie` header.
 *
 * A header rather than `cookies()` because both callers have a header and only
 * one of them has a request scope Next.js will answer `cookies()` in: the stamp
 * runs inside a Better Auth hook, where the request is the library's, not the
 * framework's. Parsed the same way `localeFromRequest` in `./server` parses it.
 */
function tokenFromCookieHeader(
  header: string | null | undefined,
): string | null {
  if (!header) return null;
  const value = header
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === trustedDeviceCookieName)?.[1];
  return value ? decodeURIComponent(value) : null;
}

/**
 * Whether this device is trusted for this account, and the row saying so.
 *
 * The account is passed in rather than read from the cookie: the row names its
 * owner, so a cookie left behind by whoever used this browser last cannot be
 * spent on the account signing in now. The digest is the whole check — the
 * secret is never stored, so there is nothing to compare in constant time.
 */
export async function trustedDeviceFor({
  userId,
  cookieHeader,
}: {
  userId: string;
  cookieHeader: string | null | undefined;
}): Promise<{ id: string } | null> {
  const token = tokenFromCookieHeader(cookieHeader);
  if (!token) return null;
  const [row] = await db
    .select({ id: trustedDevices.id })
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.tokenHash, digest(token)),
        eq(trustedDevices.userId, userId),
        gt(trustedDevices.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  // Shown in the list, so somebody deciding whether to revoke a device can see
  // which ones are actually in use. Not a sliding expiry: `expires_at` is left
  // where it was set (see the table's comment).
  await db
    .update(trustedDevices)
    .set({ lastUsedAt: new Date() })
    .where(eq(trustedDevices.id, row.id));
  return row;
}

/**
 * What to send Better Auth's verify endpoint, given what the form said.
 *
 * `trustDevice` is the library's half. It is honoured only where the factor
 * interrupted a password sign-in, and ignored on a step-up — which is why it is
 * never the thing this product relies on, and why it costs nothing to ask for it
 * every time the box is ticked.
 */
export function trustDeviceGrant(formData: FormData): boolean {
  return formData.get("trustDevice") === "on";
}

/**
 * Record this device as trusted and hand it the secret that proves it.
 *
 * Called only after a code has been confirmed: the factor is what earns the
 * trust, and this is the note kept afterwards. Each grant is its own row, so the
 * same person trusting a second browser does not displace the first, and each can
 * be revoked on its own.
 */
export async function grantTrustedDevice({
  userId,
  userAgent,
  ipAddress,
}: {
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + trustedDeviceMaxAgeSeconds * 1000);
  await db.insert(trustedDevices).values({
    userId,
    tokenHash: digest(token),
    userAgent,
    ipAddress,
    expiresAt,
  });
  (await cookies()).set(trustedDeviceCookieName, token, {
    httpOnly: true,
    /**
     * `lax`, and it has to be: the emailed link is the path this feature exists
     * to smooth, and it arrives as a top-level navigation from a mail client —
     * a cross-site context, where `strict` would withhold the cookie exactly
     * when the stamp needs to read it. `lax` still withholds it from
     * cross-site subrequests, which is what matters; and the cookie cannot be
     * spent on its own in any case, since it only ever skips a prompt on a
     * sign-in that has already been authenticated by other means.
     */
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: trustedDeviceMaxAgeSeconds,
  });
  await recordAudit({
    action: "account.trusted_device.granted",
    subjectType: "auth.trusted_devices",
    subjectId: userId,
    actorUserId: userId,
    severity: "warning",
    // Worth a warning and worth naming the device: this is the row a security
    // review reads to answer "when did that browser stop being asked".
    metadata: {
      device: describeDevice(userAgent),
      expiresAt: expiresAt.toISOString(),
    },
  });
}

export interface TrustedDeviceListing {
  id: string;
  /** Coarse, human-readable, and null when the agent said nothing useful. */
  label: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  /** True for the device making this request. */
  current: boolean;
}

/**
 * The devices this account has vouched for, newest first.
 *
 * Expired rows are filtered rather than shown greyed out: a device that is being
 * asked for a code again is not trusted, and listing it would invite somebody to
 * revoke something that has already lapsed. They are deleted by
 * `pruneExpiredTrustedDevices` on the way past.
 */
export async function listTrustedDevices({
  userId,
  cookieHeader,
}: {
  userId: string;
  cookieHeader: string | null | undefined;
}): Promise<TrustedDeviceListing[]> {
  const token = tokenFromCookieHeader(cookieHeader);
  const currentHash = token ? digest(token) : null;
  const rows = await db
    .select({
      id: trustedDevices.id,
      tokenHash: trustedDevices.tokenHash,
      userAgent: trustedDevices.userAgent,
      ipAddress: trustedDevices.ipAddress,
      createdAt: trustedDevices.createdAt,
      lastUsedAt: trustedDevices.lastUsedAt,
      expiresAt: trustedDevices.expiresAt,
    })
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.userId, userId),
        gt(trustedDevices.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(trustedDevices.lastUsedAt));
  return rows.map((row) => ({
    id: row.id,
    label: describeDevice(row.userAgent),
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    current: currentHash !== null && row.tokenHash === currentHash,
  }));
}

/**
 * Drop the rows that have lapsed, for this account only.
 *
 * A lapsed row grants nothing — every read is bounded by `expires_at` — so this
 * is housekeeping, not a control, and it runs on the page that lists the devices
 * rather than on a schedule. Better Auth expires its own markers the same lazy
 * way.
 */
export async function pruneExpiredTrustedDevices(
  userId: string,
): Promise<void> {
  await db
    .delete(trustedDevices)
    .where(
      and(
        eq(trustedDevices.userId, userId),
        lt(trustedDevices.expiresAt, new Date()),
      ),
    );
}

/**
 * Stop trusting devices: one of them, or all of them.
 *
 * Both halves go, and that is the point of doing it here rather than in the two
 * places that ask for it. Better Auth's markers carry no device identity — the
 * identifier is random and rotates on every password sign-in — so there is no
 * "this one" to revoke among them; revoking a single device therefore clears the
 * row that names it, and clears the library's markers wholesale, which costs at
 * most one extra code on some *other* password sign-in and never leaves a device
 * trusted that its owner has just untrusted.
 *
 * The cookie on the device making the request is expired too, when it is one of
 * the revoked ones, so the browser stops presenting a secret nothing will honour.
 */
export async function revokeTrustedDevices({
  userId,
  deviceId,
  cookieHeader,
}: {
  userId: string;
  /** One device, or every device when omitted. */
  deviceId?: string;
  cookieHeader: string | null | undefined;
}): Promise<number> {
  const revoked = await db
    .delete(trustedDevices)
    .where(
      deviceId
        ? and(
            eq(trustedDevices.userId, userId),
            eq(trustedDevices.id, deviceId),
          )
        : eq(trustedDevices.userId, userId),
    )
    .returning({ tokenHash: trustedDevices.tokenHash });
  if (revoked.length === 0) return 0;

  /**
   * Better Auth's markers for this account. They are rows in its single-use
   * value store, told apart by the `trust-device-` prefix on the identifier and
   * carrying the user id as the value, so both are matched: the prefix alone
   * would reach other accounts' markers, and the value alone would reach this
   * account's magic-link and code rows.
   */
  await db
    .delete(verificationTokens)
    .where(
      and(
        like(verificationTokens.identifier, `${libraryTrustIdentifierPrefix}%`),
        eq(verificationTokens.value, userId),
      ),
    );

  const token = tokenFromCookieHeader(cookieHeader);
  const currentHash = token ? digest(token) : null;
  if (currentHash && revoked.some((row) => row.tokenHash === currentHash)) {
    (await cookies()).delete(trustedDeviceCookieName);
  }

  await recordAudit({
    action: "account.trusted_device.revoked",
    subjectType: "auth.trusted_devices",
    subjectId: userId,
    actorUserId: userId,
    severity: "warning",
    metadata: { devices: revoked.length, scope: deviceId ? "one" : "all" },
  });
  return revoked.length;
}

/**
 * Forget every device on an account, without a request to read a cookie from.
 *
 * The disarm path: turning the second factor off, or having it turned off,
 * cannot leave rows behind that would skip a prompt if it were armed again.
 * There is no cookie to expire here because the caller may not be the device
 * that holds one — the rows are gone either way, and a cookie with no row
 * matches nothing.
 */
export async function forgetAllTrustedDevices(userId: string): Promise<void> {
  const revoked = await db
    .delete(trustedDevices)
    .where(eq(trustedDevices.userId, userId))
    .returning({ id: trustedDevices.id });
  await db
    .delete(verificationTokens)
    .where(
      and(
        like(verificationTokens.identifier, `${libraryTrustIdentifierPrefix}%`),
        eq(verificationTokens.value, userId),
      ),
    );
  if (revoked.length === 0) return;
  await recordAudit({
    action: "account.trusted_device.revoked",
    subjectType: "auth.trusted_devices",
    subjectId: userId,
    actorUserId: userId,
    severity: "warning",
    metadata: {
      devices: revoked.length,
      scope: "all",
      reason: "factor_changed",
    },
  });
}
