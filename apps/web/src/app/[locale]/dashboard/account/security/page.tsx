import { formatMessage } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { headers } from "next/headers";
import Link from "next/link";

import { updateAccountSignIn } from "../actions";
import { AccountStatus } from "../parts";
import {
  revokeTrustedDevice,
  signOutDevice,
  signOutEverywhere,
  signOutOtherDevices,
} from "../two-factor-actions";
import { TwoFactorCard } from "../two-factor-card";
import { Card, Field, Notice, Select } from "~/components/admin/workspace";
import { PhoneEnrolment } from "~/components/auth/phone-enrolment";
import { PendingButton } from "~/components/pending-button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  getAccountSettings,
  secondFactorMandatory,
} from "~/server/account/settings";
import { auth } from "~/server/auth";
import { passwordStatus } from "~/server/auth/password-status";
import { requireAccountHolder } from "~/server/auth/require";
import { maskPhone, secondFactorNumber } from "~/server/auth/second-factor";
import { describeDevice, listDeviceSessions } from "~/server/auth/sessions";
import {
  listTrustedDevices,
  pruneExpiredTrustedDevices,
} from "~/server/auth/trusted-device";

/**
 * Account security: the second factor, armed and disarmed.
 *
 * This is where somebody who *already* passed the gate manages their factor. An
 * account that has not — one whose role mandates a factor it never armed — never
 * reaches here: `requireEditor` sends it to `/login/verify`, outside the console,
 * because both layouts above this page run that same gate and an escape hatch
 * behind the gate it escapes redirects to itself forever. The enrolment forms are
 * shared with that page rather than duplicated.
 *
 * The gate here is still `requireAccountHolder`, so arriving mid-enrolment (after
 * confirming a code, say) renders instead of bouncing.
 *
 * The authenticator half lives in `../two-factor-card` as a client component,
 * because the secret and the backup codes are shown once and must not be re-read
 * on a later load.
 */
export default async function AccountSecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; error?: string; enrol?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [user, query, messages] = await Promise.all([
    requireAccountHolder(locale),
    searchParams,
    loadPageCatalog(locale, "dashboard-account"),
  ]);
  const session = await auth();
  const cookieHeader = (await headers()).get("cookie");
  // Lapsed rows grant nothing, so clearing them is housekeeping rather than a
  // control — done here because this is the page that reads the list.
  await pruneExpiredTrustedDevices(user.id);
  const [
    settings,
    mandatory,
    number,
    password,
    deviceSessions,
    trustedDeviceList,
  ] = await Promise.all([
    getAccountSettings(user.id),
    secondFactorMandatory(user.id),
    secondFactorNumber(user.id),
    passwordStatus(user.id),
    listDeviceSessions(user.id, session?.session.id ?? ""),
    listTrustedDevices({ userId: user.id, cookieHeader }),
  ]);

  const armed = user.twoFactorEnabled;
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: settings.timeZone,
  });

  return (
    <div className="grid gap-5">
      {/* Rendered only when there is something to say, rather than left to
          `AccountStatus` to return null: an always-present wrapper would still
          occupy a grid cell and open a `gap-5` of empty space above the cards
          on every quiet load. */}
      {(query.status ?? query.error) ? (
        <div>
          <AccountStatus
            status={query.status}
            error={query.error}
            savedLabel={messages["account.status.saved"]}
            errorLabels={{
              invalid: messages["account.status.error"],
              twoFactorRequired: messages["security.error.twoFactorRequired"],
              invalidCode: messages["security.error.invalidCode"],
              password: messages["security.error.password"],
              phone: messages["security.error.phone"],
              sendError: messages["security.error.sendError"],
              rateLimited: messages["security.error.rateLimited"],
            }}
            statusLabels={{
              twoFactorEnabled: messages["security.status.twoFactorEnabled"],
              twoFactorDisabled: messages["security.status.twoFactorDisabled"],
              codeSent: messages["security.status.codeSent"],
              othersSignedOut: messages["security.status.othersSignedOut"],
              deviceSignedOut: messages["security.status.deviceSignedOut"],
              phoneVerified: messages["security.status.phoneVerified"],
              devicesForgotten: messages["security.status.devicesForgotten"],
            }}
          />
        </div>
      ) : null}

      {query.enrol === "required" && !armed ? (
        <Notice tone="warn" title={messages["security.twoFactor.mandateTitle"]}>
          {messages["security.twoFactor.mandateHint"]}
        </Notice>
      ) : null}

      {/*
        Two columns of cards, flowed rather than gridded.
        `xl:grid-cols-2` was the obvious way and it is the wrong one: a grid row
        is as tall as its tallest cell, so a short card sitting beside a tall one
        reserves the tall one's height and leaves a visible hole underneath it
        before the next row starts. `items-start` stops the card *stretching*
        but cannot reclaim the row's height.
        CSS columns flow instead of aligning: each card takes the height it
        needs and the next one starts immediately below, so both stacks stay
        tight whatever they contain. `break-inside-avoid` keeps a card whole
        rather than splitting it across the column boundary, and the margin is
        on the children because `gap` does not apply between column items.
        The banner and the mandate notice stay outside: they are about the whole
        section, and one indented into a column reads as belonging to the card
        beneath it.

        Every card here is `h-auto`, which is load-bearing rather than tidy:
        `Card` ships `h-full` so that cards sharing a *grid row* match heights,
        and cards that flow do not share rows. Left on, that `height: 100%`
        resolved against this container and made each card as tall as the whole
        section — hundreds of pixels of nothing under the content in Chrome, and
        worse in Firefox, where a card tall enough to fill a column pushes the
        next one into a column of its own until they run off the side of the
        page instead of wrapping. `h-auto` removes the declaration outright
        (`cn` merges with tailwind-merge), so there is no percentage left for an
        engine to resolve either way.
      */}
      <div className="xl:columns-2 xl:gap-5 [&>*]:mb-5 xl:[&>*]:break-inside-avoid">
        <form action={updateAccountSignIn} className="grid gap-5">
          <input type="hidden" name="locale" value={locale} />
          <Card
            title={messages["security.heading"]}
            hint={messages["security.hint"]}
          >
            <div className="grid max-w-md gap-4">
              <Field
                label={messages["security.method"]}
                hint={messages["security.methodHint"]}
              >
                <Select
                  name="preferredSignInMethod"
                  defaultValue={
                    settings.preferredSignInMethod === "password"
                      ? "password"
                      : "magic_link"
                  }
                >
                  <option value="magic_link">
                    {messages["security.method.magic_link"]}
                  </option>
                  <option value="password">
                    {messages["security.method.password"]}
                  </option>
                </Select>
              </Field>
              <p className="text-sm">
                <Link
                  href={localizedPath("/dashboard/account/password", locale)}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  {messages["security.password.link"]}
                </Link>
              </p>
              <div>
                <PendingButton>{messages["account.save"]}</PendingButton>
              </div>
            </div>
          </Card>
        </form>

        <TwoFactorCard
          locale={locale}
          armed={armed}
          mandatory={mandatory}
          hasPassword={password.set}
          recipient={number ? maskPhone(number.phone) : null}
          labels={messages}
          className="h-auto"
        />

        <Card
          title={messages["security.sessions.heading"]}
          hint={messages["security.sessions.hint"]}
          className="h-auto"
        >
          <div className="grid gap-4">
            <ul className="grid gap-2">
              {deviceSessions.map((device) => {
                const label = describeDevice(device.userAgent);
                return (
                  <li
                    key={device.id}
                    className="border-line flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 text-sm"
                  >
                    <div className="grid min-w-0 gap-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">
                          {label ?? messages["security.sessions.unknownDevice"]}
                        </span>
                        {device.current ? (
                          <span className="text-copy-muted text-xs">
                            {messages["security.sessions.current"]}
                          </span>
                        ) : null}
                        {/* The distinction this list exists for: a session can be
                          signed in without ever having passed the factor, because
                          Better Auth does not intercept a magic link. */}
                        {device.secondFactorVerified ? null : (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-500">
                            {messages["security.sessions.unverified"]}
                          </span>
                        )}
                      </div>
                      <p className="text-copy-muted text-xs">
                        {formatMessage(messages["security.sessions.detail"], {
                          started: dateTime.format(device.createdAt),
                          expires: dateTime.format(device.expiresAt),
                        })}
                        {device.ipAddress ? ` · ${device.ipAddress}` : ""}
                      </p>
                    </div>
                    {/* One device at a time, which is what somebody who recognises
                      every row but one actually wants. On the current device it
                      is worded as leaving, because that is what it does — the
                      action lands on the login page rather than on a settings
                      page nobody is signed in to. */}
                    <form action={signOutDevice}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="sessionId" value={device.id} />
                      <PendingButton variant="secondary">
                        {device.current
                          ? messages["security.sessions.signOutThis"]
                          : messages["security.sessions.signOutOne"]}
                      </PendingButton>
                    </form>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-3">
              <form action={signOutOtherDevices}>
                <input type="hidden" name="locale" value={locale} />
                <PendingButton
                  variant="secondary"
                  disabled={deviceSessions.length < 2}
                >
                  {messages["security.sessions.signOutOthers"]}
                </PendingButton>
              </form>
              <form action={signOutEverywhere}>
                <input type="hidden" name="locale" value={locale} />
                <PendingButton variant="danger">
                  {messages["security.sessions.signOutAll"]}
                </PendingButton>
              </form>
            </div>
          </div>
        </Card>

        {/*
          Trusted devices, kept apart from the signed-in list above because they
          answer different questions: that one is "where is my account open", this
          one is "where does the code stop being asked for". A device can be on
          either list without being on the other.
      */}
        <Card
          title={messages["security.trustedDevices.heading"]}
          hint={messages["security.trustedDevices.hint"]}
          className="h-auto"
        >
          <div className="grid gap-4">
            {trustedDeviceList.length === 0 ? (
              <p className="text-copy-muted text-sm">
                {messages["security.trustedDevices.empty"]}
              </p>
            ) : (
              <ul className="grid gap-2">
                {trustedDeviceList.map((device) => (
                  <li
                    key={device.id}
                    className="border-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                  >
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">
                          {device.label ??
                            messages["security.sessions.unknownDevice"]}
                        </span>
                        {device.current ? (
                          <span className="text-copy-muted text-xs">
                            {messages["security.sessions.current"]}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-copy-muted text-xs">
                        {formatMessage(
                          messages["security.trustedDevices.detail"],
                          {
                            used: dateTime.format(device.lastUsedAt),
                            expires: dateTime.format(device.expiresAt),
                          },
                        )}
                        {device.ipAddress ? ` · ${device.ipAddress}` : ""}
                      </p>
                    </div>
                    <form action={revokeTrustedDevice}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="deviceId" value={device.id} />
                      <PendingButton variant="secondary">
                        {messages["security.trustedDevices.forget"]}
                      </PendingButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {trustedDeviceList.length > 1 ? (
              <div>
                <form action={revokeTrustedDevice}>
                  <input type="hidden" name="locale" value={locale} />
                  <PendingButton variant="danger">
                    {messages["security.trustedDevices.forgetAll"]}
                  </PendingButton>
                </form>
              </div>
            ) : null}
          </div>
        </Card>

        <PhoneEnrolment
          locale={locale}
          origin="security"
          hasPassword={password.set}
          armed={armed}
          maskedPhone={number ? maskPhone(number.phone) : null}
          pending={number !== null && !number.verified}
          labels={messages}
          className="h-auto"
        />
      </div>
    </div>
  );
}
