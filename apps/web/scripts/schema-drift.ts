/* eslint-disable no-console -- CLI drift report writes its findings to stdout */
/**
 * Compares the drizzle schema with the database it is pointed at, and prints
 * what is missing on either side. Push-mode projects drift silently: a column
 * added in TypeScript but never pushed only surfaces as a 500 on the page that
 * selects it.
 */
import "dotenv/config";
import { getTableConfig } from "drizzle-orm/pg-core";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { max: 1 });

const live = new Map<string, Set<string>>();
const rows = await sql<{ table: string; column: string }[]>`
  select table_schema || '.' || table_name as "table", column_name as "column"
  from information_schema.columns
  where table_schema not in ('pg_catalog', 'information_schema')
`;
for (const row of rows) {
  const columns = live.get(row.table) ?? new Set<string>();
  columns.add(row.column);
  live.set(row.table, columns);
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
    if (!columns.has(column.name)) {
      console.log(`MISSING COLUMN ${name}.${column.name}`);
      problems += 1;
    }
  }
}

console.log(problems === 0 ? "no drift" : `${String(problems)} problem(s)`);
await sql.end();
