/* eslint-disable no-console -- CLI drift report writes its findings to stdout */
/**
 * Compares the drizzle schema with the database it is pointed at, and prints
 * what is missing on either side. Push-mode projects drift silently: a column
 * added in TypeScript but never pushed only surfaces as a 500 on the page that
 * selects it.
 *
 * Types are compared as well as names, because the interesting drift is rarely a
 * missing column. A column whose declared type moved — `varchar(255)` to `uuid`
 * for every user id, say (docs/SCHEMA-DELIVERY-PLAN.md D1) — reads and writes
 * perfectly against the old database until the first value that does not fit,
 * and drizzle's own types say nothing, since both spellings are `string` in
 * TypeScript.
 */
import "dotenv/config";
import { getTableConfig } from "drizzle-orm/pg-core";
import postgres from "postgres";

import { migratorUrl } from "../src/server/db/migrator-url";
import * as schema from "../src/server/db/schema";
import { sslFor } from "../src/server/db/ssl";

// The owner: introspection has to see every table, and `infokit_app` is granted
// DML rather than catalog reach. A drift report from a connection that cannot see
// half the schema would read as a clean one.
//
// TLS by the same rule as the app (`../src/server/db/ssl`), because confirming a
// remote database matches the schema is the entire point of `db:drift:remote` and
// `rds.force_ssl` refuses cleartext. `sslFor` returns false for localhost, so the
// local report is unchanged.
const driftUrl = migratorUrl();
const sql = postgres(driftUrl, { ssl: sslFor(driftUrl), max: 1 });

const live = new Map<string, Map<string, string>>();
const rows = await sql<{ table: string; column: string; type: string }[]>`
  select table_schema || '.' || table_name as "table",
         column_name as "column",
         format_type(a.atttypid, a.atttypmod) as "type"
  from information_schema.columns c
  join pg_class rel on rel.relname = c.table_name
  join pg_namespace nsp
    on nsp.oid = rel.relnamespace and nsp.nspname = c.table_schema
  join pg_attribute a
    on a.attrelid = rel.oid and a.attname = c.column_name
  where c.table_schema not in ('pg_catalog', 'information_schema')
`;
for (const row of rows) {
  const columns = live.get(row.table) ?? new Map<string, string>();
  columns.set(row.column, row.type);
  live.set(row.table, columns);
}

/**
 * The same type spelled the way Postgres spells it back. Drizzle writes what it
 * would put in a `create table`; `format_type` answers with the canonical name,
 * and the two disagree on synonyms rather than on meaning.
 */
function canonical(type: string): string {
  const lower = type.toLowerCase().trim();
  if (lower.endsWith("[]")) return `${canonical(lower.slice(0, -2))}[]`;
  const synonyms: Record<string, string> = {
    "timestamp with time zone": "timestamp with time zone",
    timestamptz: "timestamp with time zone",
    "timestamp without time zone": "timestamp without time zone",
    timestamp: "timestamp without time zone",
    "time with time zone": "time with time zone",
    timetz: "time with time zone",
    "time without time zone": "time without time zone",
    time: "time without time zone",
    bool: "boolean",
    int2: "smallint",
    int4: "integer",
    int8: "bigint",
    float4: "real",
    float8: "double precision",
    varchar: "character varying",
    char: "character",
    decimal: "numeric",
  };
  const [head, ...rest] = lower.split("(");
  const base = synonyms[head?.trim() ?? ""] ?? head?.trim() ?? lower;
  return rest.length > 0 ? `${base}(${rest.join("(")}` : base;
}

/**
 * The column's declared type, qualified the way `format_type` answers for it.
 *
 * `format_type` prints the schema of any type that is not on the search path, so
 * an enum living in `core` comes back as `core.writing_direction` — while
 * drizzle's `getSQLType()` only ever says `writing_direction`. Every enum moved
 * into its domain schema (docs/SCHEMA-DELIVERY-PLAN.md 0.11), which turned all 67
 * of them into false mismatches until this qualified the schema side too.
 *
 * The schema is read off the column's own enum rather than looked up by name, so
 * it stays right if two schemas ever declare an enum that shares a name — which
 * `pnpm db:names` permits, since Postgres scopes type names per schema.
 */
function declaredType(column: {
  getSQLType: () => string;
  enum?: { schema?: string };
}): string {
  const type = column.getSQLType();
  const namespace = column.enum?.schema;
  return namespace && namespace !== "public" ? `${namespace}.${type}` : type;
}

let problems = 0;
for (const value of Object.values(schema)) {
  let config;
  try {
    config = getTableConfig(value as never);
  } catch {
    continue;
  }
  const name = `${config.schema ?? "public"}.${config.name}`;
  const columns = live.get(name);
  if (!columns) {
    console.log(`MISSING TABLE  ${name}`);
    problems += 1;
    continue;
  }
  for (const column of config.columns) {
    const liveType = columns.get(column.name);
    if (liveType === undefined) {
      console.log(`MISSING COLUMN ${name}.${column.name}`);
      problems += 1;
      continue;
    }
    const declared = canonical(declaredType(column));
    if (canonical(liveType) !== declared) {
      console.log(
        `TYPE MISMATCH  ${name}.${column.name}: schema ${declared}, database ${canonical(liveType)}`,
      );
      problems += 1;
    }
  }
}

console.log(problems === 0 ? "no drift" : `${String(problems)} problem(s)`);
await sql.end();
