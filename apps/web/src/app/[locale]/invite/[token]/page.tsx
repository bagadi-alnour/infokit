import type { Metadata } from "next";
import type { ReactNode } from "react";

import { brandName, formatMessage, type Locale } from "@infokit/shared/i18n";
import {
  loadPageCatalog,
  type PageCatalog,
} from "@infokit/shared/i18n/catalogs";

import { endEditorSession } from "~/app/[locale]/login/actions";
import { AuthShell } from "~/components/auth/auth-shell";
import { SubmitButton } from "~/components/auth/submit-button";
import {
  ActionLink,
  Callout,
  Chip,
  SurfaceCard,
} from "~/components/public/primitives";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { auth } from "~/server/auth";
import {
  describeInvitationToken,
  INVITATION_TTL_DAYS,
  type InvitationView,
} from "~/server/invitations";
import { acceptInvitation } from "./actions";

type Catalog = PageCatalog<"invite">;

/**
 * The invitation is read per request and never cached: it is a token being
 * exchanged for a decision, and a stale copy would tell somebody an invitation
 * is live after it was withdrawn.
 */
export const dynamic = "force-dynamic";

interface InvitePageProps {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ status?: string }>;
}

/**
 * Never indexed and never described: the title would otherwise put an
 * organisation's name in a search result keyed to a live invitation token.
 */
export async function generateMetadata({
  params,
}: InvitePageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "invite");
  return {
    title: t["invite.metaTitle"],
    description: t["invite.metaDescription"],
    robots: { index: false, follow: false, noarchive: true, nocache: true },
  };
}

export default async function InvitePage({
  params,
  searchParams,
}: InvitePageProps) {
  const { locale: routeLocale, token } = await params;
  const locale = requireRouteLocale(routeLocale);
  const t = await loadPageCatalog(locale, "invite");
  const { status } = await searchParams;
  const [invitation, session] = await Promise.all([
    describeInvitationToken(token),
    auth(),
  ]);
  const signedInEmail = session?.user.email ?? null;

  const shell = (children: ReactNode) => (
    <AuthShell
      locale={locale}
      pathname={`/invite/${token}`}
      eyebrow={t["invite.eyebrow"]}
      title={t["invite.title"]}
      description={t["invite.description"]}
      messages={t}
    >
      <div className="flex flex-col gap-5">{children}</div>
    </AuthShell>
  );

  const consoleLink = (
    <ActionLink href={localizedPath("/dashboard", locale)} size="block">
      {t["invite.consoleAction"]}
    </ActionLink>
  );

  /**
   * A token that matches nothing and a token that was never valid read the
   * same, on purpose: the page has nothing to distinguish for the person
   * holding the link, and guessing tokens should learn nothing from the reply.
   */
  if (!invitation) {
    return shell(
      <Callout tone="warning" title={t["invite.unknownTitle"]} role="alert">
        {t["invite.unknownBody"]}
      </Callout>,
    );
  }

  if (invitation.state === "revoked") {
    return shell(
      <Callout tone="warning" title={t["invite.revokedTitle"]} role="alert">
        {t["invite.revokedBody"]}
      </Callout>,
    );
  }

  if (invitation.state === "expired") {
    return shell(
      <>
        <Callout tone="warning" title={t["invite.expiredTitle"]} role="alert">
          {formatMessage(t["invite.expiredBody"], {
            days: String(INVITATION_TTL_DAYS),
          })}
        </Callout>
        <Summary invitation={invitation} locale={locale} t={t} />
      </>,
    );
  }

  if (invitation.state === "accepted") {
    return shell(
      <>
        <Callout tone="info" title={t["invite.acceptedTitle"]}>
          {signedInEmail
            ? t["invite.acceptedDoneBody"]
            : t["invite.acceptedBody"]}
        </Callout>
        <Summary invitation={invitation} locale={locale} t={t} />
        {signedInEmail ? (
          consoleLink
        ) : (
          <SignInPrompt
            invitation={invitation}
            token={token}
            locale={locale}
            t={t}
          />
        )}
      </>,
    );
  }

  // Open, and nobody is signed in: the invitation is described, and the only
  // action is to go and prove the address.
  if (!signedInEmail) {
    return shell(
      <>
        <Summary invitation={invitation} locale={locale} t={t} />
        <SignInPrompt
          invitation={invitation}
          token={token}
          locale={locale}
          t={t}
        />
      </>,
    );
  }

  // Open, but this browser holds somebody else's session. Never accepted
  // silently — the grant would land on the wrong account.
  if (
    signedInEmail.trim().toLowerCase() !== invitation.email.trim().toLowerCase()
  ) {
    return shell(
      <>
        <Summary invitation={invitation} locale={locale} t={t} />
        <Callout
          tone="warning"
          title={t["invite.wrongAccountTitle"]}
          role="alert"
        >
          {formatMessage(t["invite.wrongAccountBody"], {
            invited: invitation.email,
            current: signedInEmail,
          })}
        </Callout>
        <form action={endEditorSession}>
          <input type="hidden" name="locale" value={locale} />
          <input
            type="hidden"
            name="returnTo"
            value={localizedPath(`/invite/${token}`, locale)}
          />
          <SubmitButton
            label={t["invite.signOutAction"]}
            pendingLabel={t["invite.signOutAction"]}
            tone="ghost"
          />
        </form>
      </>,
    );
  }

  // Open, signed in as the invited address: one button away.
  return shell(
    <>
      <Summary invitation={invitation} locale={locale} t={t} />
      {status ? (
        <Callout tone="danger" title={t["invite.acceptError"]} role="alert" />
      ) : null}
      <SurfaceCard className="flex flex-col gap-3 p-5">
        <h2 className="text-ink text-lg font-bold">
          {t["invite.acceptHeading"]}
        </h2>
        <p className="text-copy-muted text-[0.95rem] leading-relaxed">
          {formatMessage(t["invite.acceptBody"], { email: signedInEmail })}
        </p>
        <form action={acceptInvitation}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <SubmitButton
            label={t["invite.acceptAction"]}
            pendingLabel={t["invite.acceptAction"]}
          />
        </form>
      </SurfaceCard>
    </>,
  );
}

/**
 * What the invitation is, before any decision about it. The same block appears
 * under every state — somebody whose link expired still needs to know which
 * organisation it was for, so they can ask the right person for another.
 */
function Summary({
  invitation,
  locale,
  t,
}: {
  invitation: InvitationView;
  locale: Locale;
  t: Catalog;
}) {
  const label =
    invitation.kind === "platform_admin"
      ? t["invite.platformLabel"]
      : invitation.kind === "translator"
        ? t["invite.translatorLabel"]
        : t["invite.organizationLabel"];
  const name = invitation.organizationName ?? brandName(locale);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <SurfaceCard className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <p className="text-eyebrow text-copy-muted">{label}</p>
        <p className="text-ink text-xl font-bold leading-tight">{name}</p>
        {invitation.inviterName ? (
          <p className="text-copy-muted text-[0.95rem]">
            {formatMessage(t["invite.invitedBy"], {
              inviter: invitation.inviterName,
            })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
          {t["invite.rolesLabel"]}
        </p>
        {invitation.roleCodes.length === 0 ? (
          <p className="text-copy-muted text-[0.95rem]">
            {t["invite.rolesNone"]}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {invitation.roleCodes.map((code) => (
                <Chip key={code}>{code}</Chip>
              ))}
            </div>
            <p className="text-copy-muted text-sm">{t["invite.roleHint"]}</p>
          </>
        )}
      </div>

      <div className="border-line flex flex-col gap-1 border-t pt-3">
        <p className="text-copy-muted text-sm">
          {formatMessage(t["invite.sentTo"], { email: invitation.email })}
        </p>
        <p className="text-copy-muted text-sm">
          {formatMessage(t["invite.expiresOn"], {
            date: dateFormat.format(invitation.expiresAt),
          })}
        </p>
      </div>
    </SurfaceCard>
  );
}

/**
 * The hand-off to sign-in. `returnTo` brings them back here so the link they
 * were sent is what confirms the invitation was accepted, rather than dropping
 * them on a console that never mentions it.
 */
function SignInPrompt({
  invitation,
  token,
  locale,
  t,
}: {
  invitation: InvitationView;
  token: string;
  locale: Locale;
  t: Catalog;
}) {
  return (
    <SurfaceCard className="flex flex-col gap-3 p-5">
      <h2 className="text-ink text-lg font-bold">
        {t["invite.signInHeading"]}
      </h2>
      <p className="text-copy-muted text-[0.95rem] leading-relaxed">
        {formatMessage(t["invite.signInBody"], { email: invitation.email })}
      </p>
      <ActionLink
        href={localizedPath("/login", locale, {
          returnTo: localizedPath(`/invite/${token}`, locale),
        })}
        size="block"
      >
        {t["invite.signInAction"]}
      </ActionLink>
      <p className="text-copy-muted text-sm">{t["invite.privacy"]}</p>
    </SurfaceCard>
  );
}
