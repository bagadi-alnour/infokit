import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth/auth-shell";
import { ActionLink } from "~/components/public/primitives";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath, localizedPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";
import { recordAudit } from "~/server/audit";
import { auth, authServer } from "~/server/auth";
import { secondFactorMandatory } from "~/server/account/settings";

interface DeviceHandoffPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}

export async function generateMetadata({
  params,
}: DeviceHandoffPageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login-verify");
  return localizedAuthMetadata({
    route: "verify",
    locale,
    title: messages["auth.device.title"],
    description: messages["auth.device.body"],
  });
}

/**
 * Where a magic link finishes when it was asked for by the phone app.
 *
 * The link can only be verified where it is opened — the system browser — and
 * Better Auth sets the session cookie in *that* jar, which the app cannot read.
 * So the app points `callbackURL` here, and this page turns the browser's
 * freshly-minted session into a one-time token and deep-links it to the app,
 * which trades it for the same session through its own client.
 *
 * This is the hand-off the migration deleted, rebuilt on the library: Better
 * Auth owns the token, its two-minute expiry and its single use, where a bespoke
 * `device_grants` table used to do all three by hand.
 *
 * The gate matters as much as the hand-off. A magic link is not a path Better
 * Auth intercepts for the second factor, so the session arriving here may not
 * have passed one — and minting a token from it would hand the app a session
 * that skipped the factor. Nothing is minted until the factor is satisfied.
 */
export default async function DeviceHandoffPage({
  params,
  searchParams,
}: DeviceHandoffPageProps) {
  const locale = requireRouteLocale((await params).locale);
  const [query, messages] = await Promise.all([
    searchParams,
    loadPageCatalog(locale, "login-verify"),
  ]);
  const returnTo = localizedPath("/login/device", locale);

  const session = await auth();
  if (!session?.user) redirect(authPath("login", locale, { returnTo }));

  // The same two refusals `requireEditor` makes, for the same reasons — a
  // factor owed is stepped up, a factor missing is enrolled.
  if (!session.secondFactorVerified) {
    if (session.user.twoFactorEnabled) {
      redirect(authPath("verify", locale, { returnTo }));
    }
    if (await secondFactorMandatory(session.user.id)) {
      redirect(
        `${localizedPath("/dashboard/account/security", locale)}?${new URLSearchParams(
          { enrol: "required", returnTo },
        ).toString()}`,
      );
    }
  }

  let deepLink: string | null = null;
  if (!query.error) {
    try {
      const { token } = await authServer.api.generateOneTimeToken({
        headers: await headers(),
      });
      await recordAudit({
        action: "auth.device_handoff.issued",
        subjectType: "auth.session",
        subjectId: session.user.id,
        actorUserId: session.user.id,
      });
      deepLink = `infokit://sign-in?token=${encodeURIComponent(token)}`;
    } catch {
      await recordAudit({
        action: "auth.device_handoff.failed",
        subjectType: "auth.session",
        subjectId: session.user.id,
        actorUserId: session.user.id,
        outcome: "failure",
        severity: "warning",
      });
    }
  }

  return (
    <AuthShell
      locale={locale}
      pathname="/login/device"
      eyebrow={messages["auth.device.eyebrow"]}
      title={messages["auth.device.title"]}
      description={
        deepLink ? messages["auth.device.body"] : messages["auth.device.failed"]
      }
      messages={messages}
    >
      <div className="flex flex-col gap-5">
        {deepLink ? (
          <>
            {/*
              A link the reader taps, not an automatic redirect. iOS and Android
              both refuse to open a custom scheme without a user gesture when the
              navigation was not initiated by one, so a redirect here would fail
              silently on the platforms this page exists for.
            */}
            <ActionLink href={deepLink} tone="solid" size="block">
              {messages["auth.device.open"]}
            </ActionLink>
            <p className="text-copy-muted text-[0.95rem]">
              {messages["auth.device.expires"]}
            </p>
          </>
        ) : (
          <ActionLink
            href={authPath("login", locale)}
            tone="outline"
            size="block"
          >
            {messages["auth.device.retry"]}
          </ActionLink>
        )}
      </div>
    </AuthShell>
  );
}
