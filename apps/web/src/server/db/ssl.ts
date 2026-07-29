import { RDS_CA_EU_WEST_3 } from "./rds-ca-eu-west-3";

/**
 * Where a connection string points, and what TLS it therefore gets.
 *
 * Four entry points ask this question and have to answer it the same way: the
 * running app (`./index`), drizzle-kit through `drizzle.config.ts`, the push guard
 * (`scripts/db-push-guard.ts`) and the drift report. Two of them are *deciding
 * whether to refuse*, so a disagreement about what counts as local would not be a
 * style difference — it would be a guard that permits what the app treats as
 * production.
 *
 * Deliberately importable outside Next.js: only the CA module is imported, never
 * `~/env`, because `drizzle.config.ts` is loaded by drizzle-kit with no Next
 * runtime and no business validating `AUTH_SECRET` (see `./migrator-url`).
 */

/**
 * The hosts that are this machine. Local Postgres runs in Docker with TLS switched
 * off, so it is the only target allowed to connect in the clear; everything else is
 * a network hop to a database whose credential does not expire.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * The hostname `url` points at, or null if it cannot be read.
 *
 * Returns the host and never the URL, and that is the whole point of the helper:
 * the password rides inside the connection string, so any thrown error or log line
 * that carried the full string would put a non-expiring credential into a log
 * drain, where it would outlive the incident that produced it.
 */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Whether `url` addresses this machine.
 *
 * An unparseable URL counts as remote. That is the fail-closed direction for every
 * caller: for the app the consequence is a refused handshake where guessing "local"
 * would put a plaintext password on the wire, and for the push guard it is a
 * refusal to push where guessing "local" would rewrite a production schema.
 */
export function isLocalTarget(url: string): boolean {
  const host = hostOf(url);
  return host !== null && LOCAL_HOSTS.has(host);
}

/**
 * The `ssl` option for a postgres.js connection to `url`.
 *
 * `verify-full`, spelled out. `rejectUnauthorized` is what checks the chain against
 * the CA, and `servername` is what checks the certificate actually names the host we
 * asked for — without the second, anything holding a certificate signed by Amazon
 * RDS could answer for our endpoint and collect the password.
 *
 * Bare `sslmode=require` encrypts without authenticating the server, so it is not
 * enough here: with password auth and no expiry, a single successful
 * man-in-the-middle yields a credential that keeps working. Callers pass this
 * object explicitly, which also means an `sslmode` appended to the URL cannot
 * weaken it.
 *
 * The bundle covers eu-west-3 only. Moving regions means replacing it, and a
 * mismatch fails the handshake rather than quietly downgrading.
 */
export function sslFor(url: string): false | SslOptions {
  if (isLocalTarget(url)) return false;
  return {
    ca: RDS_CA_EU_WEST_3,
    rejectUnauthorized: true,
    servername: hostOf(url) ?? undefined,
  };
}

interface SslOptions {
  ca: string;
  rejectUnauthorized: true;
  servername: string | undefined;
}
