import "dotenv/config";
import { type Config } from "drizzle-kit";

import { migratorUrl } from "./src/server/db/migrator-url";
import { sslFor } from "./src/server/db/ssl";

/**
 * The connection, spelled out field by field rather than as a URL.
 *
 * That is not a style choice, it is the only form in which drizzle-kit honours
 * `ssl`. Given `dbCredentials: { url, ssl }` it builds its client as
 * `postgres(credentials.url, { max: 1 })` and drops every other key on the floor
 * (drizzle-kit 0.31.10, `bin.cjs`); only the field form reaches the
 * `postgres({ ...credentials, max: 1 })` branch that keeps `ssl`. Passing a URL
 * therefore produced a *cleartext* connection to RDS, which `rds.force_ssl`
 * rejects at the first statement — `no pg_hba.conf entry … no encryption` — with
 * drizzle-kit's spinner swallowing the message, so it surfaced as a bare exit 1.
 *
 * `ssl` is omitted rather than set to `false` for local, because drizzle-kit
 * validates it as string-or-object and a boolean fails the schema. `sslFor`
 * already answers `false` for localhost, so there is nothing to pass. `servername`
 * survives our side and is stripped by drizzle-kit's validator; the handshake
 * verifies the host either way, since postgres.js falls back to the connection
 * host for the certificate check.
 */
function migratorCredentials() {
  const url = migratorUrl();
  const parsed = new URL(url);
  const ssl = sslFor(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.pathname.replace(/^\//, ""),
    ...(parsed.username ? { user: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password
      ? { password: decodeURIComponent(parsed.password) }
      : {}),
    ...(ssl ? { ssl } : {}),
  };
}

export default {
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // The owner, not the app: `db:migrate` writes DDL, `db:studio` reads and edits
  // whatever it is shown, and `db:push` does both. One line covers all three.
  //
  // TLS by the same rule the app uses (src/server/db/ssl.ts), which matters more
  // here than there: this connection carries the *owner* password, so an
  // unauthenticated channel would expose the one credential that can drop the
  // schema. `db:migrate:remote` is the only thing that points this at RDS.
  dbCredentials: migratorCredentials(),
  // `public` is deliberately absent: every enum now declares its own schema
  // (src/server/db/schema/schemas.ts), so nothing this schema owns lives there.
  schemaFilter: [
    "auth",
    "core",
    "content",
    // The shared coordination agenda (docs/DATABASE-SCHEMA.md §13).
    "operations",
    "simulator",
    "notifications",
    "audit",
  ],
} satisfies Config;
