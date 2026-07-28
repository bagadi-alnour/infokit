import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth/auth-shell";
import { Button } from "~/components/ui/button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";
import { auth } from "~/server/auth";
import { issueDeviceGrant } from "~/server/auth/device-session";
import { requireEditor } from "~/server/auth/require";

interface DeviceHandoffPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: DeviceHandoffPageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "member");
  return localizedAuthMetadata({
    route: "device",
    locale,
    title: messages["member.device.title"],
    description: messages["member.device.body"],
  });
}

/** A grant is minted per visit, so the page must never be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * The last step of signing in on a phone.
 *
 * The app has no sign-in of its own: it opened this site's ordinary sign-in in
 * the system browser, which means the email link and the SMS step-up already
 * happened here, under the same allowlist as the console. This page hands the
 * finished session over — as a one-time code that lives two minutes, carried by
 * a deep link the reader taps, or typed in by hand when the link does not fire.
 *
 * The session token itself never travels in a URL: the app trades the code for
 * it over HTTPS, so nothing durable is left in browser history or in a log.
 */
export default async function DeviceHandoffPage({
  params,
}: DeviceHandoffPageProps) {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "member");
  // The same gate the console uses: signed in, and stepped up if the account
  // requires it. A phone cannot obtain more than the browser just proved.
  const user = await requireEditor(locale);
  const session = await auth();
  if (!session?.user) redirect(authPath("login", locale));

  const grant = await issueDeviceGrant({
    userId: user.id,
    secondFactorVerified: session.secondFactorVerified,
  });

  return (
    <AuthShell
      locale={locale}
      pathname="/login/device"
      eyebrow={messages["member.account"]}
      title={messages["member.device.title"]}
      description={messages["member.device.body"]}
      messages={messages}
    >
      {grant.status === "rate_limited" ? (
        <p className="text-copy text-[0.95rem]" role="status">
          {messages["member.device.rateLimited"]}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <Button
            size="lg"
            className="h-12 w-full text-base"
            render={
              <a
                href={`infokit://sign-in?code=${encodeURIComponent(grant.code)}`}
              />
            }
          >
            {messages["member.device.open"]}
          </Button>

          <div className="flex flex-col gap-2">
            <p className="text-copy-muted text-[0.95rem]">
              {messages["member.device.code"]}
            </p>
            {/* Digits stay left-to-right and grouped in every language: this is
                read off one screen and typed into another. */}
            <p
              dir="ltr"
              className="font-display text-ink text-3xl font-bold tabular-nums tracking-[0.12em]"
            >
              {grant.code}
            </p>
            <p className="text-copy-muted text-sm">
              {messages["member.device.expires"]}
            </p>
          </div>

          <p className="text-copy-muted text-sm">
            {messages["member.device.wrongDevice"]}
          </p>
        </div>
      )}
    </AuthShell>
  );
}
