/* eslint-disable no-console -- CLI guard explains its refusal on stdout */
/**
 * `drizzle-kit push`, but only where pushing is still the right tool.
 *
 * Push diffs the TypeScript schema against a live database and applies the
 * difference. It leaves no record of what it did, so a database it has touched can
 * no longer be rebuilt from `drizzle/`, and the migration chain that is supposed to
 * describe it silently stops being true. That was an acceptable trade while every
 * table was empty and the schema changed hourly (docs/SCHEMA-DELIVERY-PLAN.md §0.3);
 * it stopped being acceptable the moment the baseline landed.
 *
 * The two refusals below are what replaces remembering. Neither needs a flag or an
 * env var to be set correctly, because both read the state that actually decides the
 * answer:
 *
 *   1. A target that is not this machine. Catches the production endpoint before a
 *      socket is even opened — `pnpm db:push` with `.env.prod.local` loaded is one
 *      absent-minded moment away from `drizzle-kit` diffing RDS and dropping a
 *      column it cannot see a reason for.
 *
 *   2. A database that has migrations applied. Catches the ordinary local mistake:
 *      pushing to the development database, which now *is* described by the chain,
 *      and thereby making `drizzle/` a fiction on the machine where migrations are
 *      written. The clue is `drizzle.__drizzle_migrations`, the journal table
 *      drizzle-kit creates on its first `migrate`.
 *
 * What survives is the one case §0.3 keeps push for: a throwaway local database used
 * to try a schema shape out before committing to a migration for it. That database
 * has never been migrated, so it passes both checks.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import postgres from "postgres";

import { migratorUrl } from "../src/server/db/migrator-url";
import { hostOf, isLocalTarget } from "../src/server/db/ssl";

const url = migratorUrl();

// Both messages name the host and never the URL: the owner password is inside the
// connection string, and a refusal is exactly the moment someone pastes the output
// into a chat or an issue.
const host = hostOf(url) ?? "an address that is not a URL";

if (!isLocalTarget(url)) {
  console.error(
    `Refusing to push: the target is ${host}, which is not this machine.\n` +
      "\n" +
      "Push applies a schema diff with no record of having done so, which is not\n" +
      "something to do to a database holding real content. Apply the reviewed\n" +
      "chain instead:\n" +
      "\n" +
      "  ENV_FILE=.env.prod.local pnpm db:migrate:remote\n" +
      "\n" +
      "If a schema change is missing from the chain, `pnpm db:generate` writes it\n" +
      "and `pnpm db:drift` says whether one is missing at all.",
  );
  process.exit(1);
}

// Local by the check above, so cleartext is correct here and TLS is not configured;
// `src/server/db/ssl.ts` is what makes that the same judgement the app makes.
const sql = postgres(url, { max: 1 });

// `to_regclass` answers null rather than raising for a name that does not resolve,
// which is what makes it usable as a question. The owner is connected, so the
// table's visibility is not in doubt — an app-role connection cannot see the
// `drizzle` schema at all and would read "absent" for a migrated database.
const [journal] = await sql<{ exists: boolean }[]>`
  select to_regclass('drizzle.__drizzle_migrations') is not null as "exists"
`;

// Counted in a second round trip rather than as a subquery in the first: a name is
// resolved when the statement is planned, not when its WHERE is evaluated, so one
// query mentioning the table would raise `relation does not exist` on precisely the
// database that is allowed to be pushed to.
const applied = journal?.exists
  ? (
      await sql<{ count: number }[]>`
        select count(*)::int as "count" from drizzle.__drizzle_migrations
      `
    )[0]?.count
  : undefined;
await sql.end();

if (journal?.exists) {
  console.error(
    `Refusing to push: ${host} has ${String(applied ?? 0)} migration(s) applied.\n` +
      "\n" +
      "This database is described by drizzle/ and pushing would make that\n" +
      "description wrong — silently, and on the machine where the next migration\n" +
      "gets written. The loop the baseline replaced push with:\n" +
      "\n" +
      "  pnpm db:generate   # write the migration for the schema change\n" +
      "  pnpm db:migrate    # apply it\n" +
      "  pnpm db:drift      # confirm schema and database agree\n" +
      "\n" +
      "To try a schema shape out first, push at a database that has never been\n" +
      "migrated: create one, point DATABASE_URL_MIGRATOR at it, and push there.",
  );
  process.exit(1);
}

console.log(
  `Pushing to ${host}: no migrations applied, so nothing to contradict.`,
);

// `node_modules/.bin` is on PATH inside a pnpm script, which is also the only way
// this script is meant to run. Inherited stdio keeps drizzle-kit's own interactive
// prompts — the ones that ask before a destructive change — working.
const push = spawnSync("drizzle-kit", ["push"], { stdio: "inherit" });

if (push.error) {
  console.error(
    `Could not run drizzle-kit: ${push.error.message}\n` +
      "Run this through pnpm (`pnpm db:push`) so that node_modules/.bin is on PATH.",
  );
  process.exit(1);
}

// A signal leaves `status` null; reporting 1 keeps a killed push from reading as a
// successful one to whatever called this.
process.exit(push.status ?? 1);
