/**
 * Which connection string an entry point that does DDL, seeding or introspection
 * should use.
 *
 * Two identities exist in every environment, local included
 * (docs/SCHEMA-DELIVERY-PLAN.md §0.4). `DATABASE_URL` is the application,
 * connecting as `infokit_app`: it owns nothing, holds no UPDATE or DELETE on the
 * append-only tables, and — once 0.5 lands — is subject to row-level security.
 * `DATABASE_URL_MIGRATOR` is `postgres`, the owner, which is what creating a
 * table, writing a catalogue or reading the whole catalog requires.
 *
 * Local is a two-URL setup on purpose, not by inheritance from production. A
 * table's owner bypasses RLS, so if local `DATABASE_URL` stayed `postgres`, every
 * policy written from 0.5 onwards would do nothing on the machine it was written
 * on and everything in production. That is the one environment split worth paying
 * to avoid.
 *
 * The fallback is what keeps a checkout with one URL working — a database that
 * never created the restricted role has only the one identity — and it is why
 * this returns a URL rather than asserting which role is behind it. What each
 * caller needs is a connection that may write DDL; a database where that is
 * `DATABASE_URL` is a database where the distinction does not exist yet.
 *
 * Deliberately not routed through `~/env`: this is imported by
 * `drizzle.config.ts`, which drizzle-kit loads outside Next.js, and by two CLI
 * seeds. Pulling the validated env in would drag the whole client/server schema
 * into a context that has no business validating `AUTH_SECRET`.
 */
export function migratorUrl(): string {
  const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Neither DATABASE_URL_MIGRATOR nor DATABASE_URL is set. The first is the" +
        " owner (`postgres`) and is what DDL and seeding need; see" +
        " apps/web/.env.example.",
    );
  }
  return url;
}
