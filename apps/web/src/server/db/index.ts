import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";
import { sslFor } from "./ssl";

const options: postgres.Options<Record<string, never>> = {
  /**
   * `verify-full` for anything that is not this machine, and cleartext only for
   * local Docker. The decision lives in `./ssl` because the push guard and
   * drizzle-kit have to reach the same verdict about the same URL — see that file
   * for why an unparseable URL counts as remote.
   */
  ssl: sslFor(env.DATABASE_URL),

  /**
   * Two connections per instance, not postgres.js's default of ten. Vercel scales
   * horizontally, so the `globalThis` cache below is per-instance and the real
   * multiplier is the instance count: at 2 the `CONNECTION LIMIT 90` from
   * drizzle/0002_roles.sql accommodates ~45 concurrent instances, where 10 would
   * exhaust it at 9 and start refusing connections — including, without the limit,
   * the ones migrations need.
   *
   * Safe at 2 because no query inside a `db.transaction()` callback uses `db`
   * instead of the `tx` handle; all 60 transaction sites were checked. Such a query
   * would need a second connection while the first is held, which at max 2 is a
   * deadlock under concurrency rather than the slow query it looks like locally.
   *
   * Watch `DatabaseConnections` against `max_connections`. If it approaches the
   * ceiling the answer is RDS Proxy, and note that its transaction pooling mode
   * needs `prepare: false` added here — prepared statements do not survive a
   * connection being handed to another client mid-session.
   */
  max: 2,
  /** Return connections to the pool quickly; idle ones still count against the cap. */
  idle_timeout: 20,
  /** Fail a dead endpoint fast rather than holding a request open for the default. */
  connect_timeout: 10,
};

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL, options);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
