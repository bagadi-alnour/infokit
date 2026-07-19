import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter, AdapterSession } from "next-auth/adapters";

import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { editorRecipient } from "./editors";
import { hashSessionToken } from "./session-token";

const drizzleAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

function withRawToken(
  session: AdapterSession | null | undefined,
  rawToken: string,
): AdapterSession | null | undefined {
  if (session === null) return null;
  return session ? { ...session, sessionToken: rawToken } : undefined;
}

/**
 * Auth.js keeps the random session token in the browser; only its SHA-256
 * digest is stored in PostgreSQL. The wrapper translates at the adapter edge.
 */
export const authAdapter: Adapter = {
  ...drizzleAdapter,
  async createVerificationToken(token) {
    // Preserve the provider's generic success response without retaining an
    // unapproved address or creating a usable token for it.
    if (!editorRecipient(token.identifier)) return token;
    const created = await drizzleAdapter.createVerificationToken?.(token);
    if (!created)
      throw new Error("Auth adapter did not create a verification token");
    return created;
  },
  async createSession(session) {
    const rawToken = session.sessionToken;
    const created = await drizzleAdapter.createSession?.({
      ...session,
      sessionToken: hashSessionToken(rawToken),
    });
    if (!created) throw new Error("Auth adapter did not create a session");
    return { ...created, sessionToken: rawToken };
  },
  async getSessionAndUser(rawToken) {
    const result = await drizzleAdapter.getSessionAndUser?.(
      hashSessionToken(rawToken),
    );
    if (!result) return null;
    return {
      ...result,
      session: { ...result.session, sessionToken: rawToken },
    };
  },
  async updateSession(session) {
    const rawToken = session.sessionToken;
    const updated = await drizzleAdapter.updateSession?.({
      ...session,
      sessionToken: hashSessionToken(rawToken),
    });
    return withRawToken(updated ?? undefined, rawToken);
  },
  async deleteSession(rawToken) {
    const deleted = await drizzleAdapter.deleteSession?.(
      hashSessionToken(rawToken),
    );
    return withRawToken(deleted ?? undefined, rawToken);
  },
};
