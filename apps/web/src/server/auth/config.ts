import { isLocale, type Locale } from "@infokit/shared/i18n";
import { type DefaultSession, type NextAuthConfig } from "next-auth";

import { env } from "~/env";
import { authPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { authAdapter } from "./adapter";
import { sendMagicLinkEmail } from "./aws";
import { canSignIn } from "./eligibility";
import { linkPendingMemberships } from "./link-memberships";

declare module "next-auth" {
  interface Session extends DefaultSession {
    secondFactorVerified: boolean;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

async function localeFromRequest(request: Request): Promise<Locale> {
  const locale = new URLSearchParams(await request.clone().text()).get(
    "locale",
  );
  return isLocale(locale) ? locale : "fr";
}

export function createAuthConfig(locale: Locale): NextAuthConfig {
  return {
    adapter: authAdapter,
    trustHost: env.AUTH_TRUST_HOST,
    providers: [
      {
        id: "ses",
        type: "email",
        name: "Amazon SES",
        from: "InfoKit",
        maxAge: 15 * 60,
        options: {},
        async sendVerificationRequest({
          identifier,
          url,
          request,
        }: {
          identifier: string;
          url: string;
          request: Request;
        }) {
          await sendMagicLinkEmail({
            email: identifier,
            url,
            locale: await localeFromRequest(request),
          });
        },
      },
    ],
    pages: {
      signIn: authPath("login", locale),
      verifyRequest: authPath("check", locale),
      error: authPath("error", locale),
    },
    session: {
      strategy: "database",
      maxAge: 8 * 60 * 60,
      updateAge: 60 * 60,
    },
    callbacks: {
      async signIn({ user, email }) {
        if (!user.email) return false;
        // Anti-enumeration by design: the request phase reports success for
        // any address so outsiders cannot probe who has access — but
        // sendMagicLinkEmail() silently drops addresses the database does not
        // know, and this callback still blocks them at link consumption below.
        if (email?.verificationRequest) return true;
        return canSignIn(user.email);
      },
      session: ({ session, user }) => {
        const databaseSession = session as typeof session & {
          secondFactorVerifiedAt?: Date | null;
        };
        return {
          ...session,
          secondFactorVerified: Boolean(databaseSession.secondFactorVerifiedAt),
          user: {
            ...session.user,
            id: user.id,
          },
        };
      },
    },
    events: {
      async signIn({ user }) {
        if (user.email && user.id) {
          await linkPendingMemberships({ userId: user.id, email: user.email });
        }
        // The actor is named explicitly: this runs while the session is still
        // being established, so asking `auth()` who it is would answer nobody.
        await recordAudit({
          action: "auth.magic_link.signed_in",
          subjectType: "auth.session",
          subjectId: user.id ?? null,
          actorUserId: user.id ?? null,
        });
      },
      async signOut(message) {
        if (!("session" in message) || !message.session?.userId) return;
        await recordAudit({
          action: "auth.session.signed_out",
          subjectType: "auth.session",
          subjectId: message.session.userId,
          actorUserId: message.session.userId,
        });
      },
    },
  } satisfies NextAuthConfig;
}
