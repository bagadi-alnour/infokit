/* eslint-disable no-console -- CLI check writes its findings to stdout */
/**
 * Fails when an identifier this schema declares would not survive Postgres, or
 * would not survive drizzle-kit on the way there.
 *
 * Postgres truncates any identifier past 63 bytes (`NAMEDATALEN - 1`) and only
 * raises a NOTICE on the way. The name in the database then differs from the
 * name in the schema and neither side knows: `drizzle-kit push` re-creates the
 * constraint on every run because it never finds the name it wrote, a generated
 * migration carries a name the database silently rewrites, and a
 * constraint-violation error quotes the truncated name, which greps to nothing.
 *
 * Worse than the churn is the collision. Two distinct names that share their
 * first 63 bytes become one name in the database — the second `ALTER TABLE`
 * fails, or for an index attaches to something other than what was meant. There
 * are none today, and nothing was preventing the first one.
 *
 * The third check is not Postgres's rule but drizzle-kit's bug, and it fails a
 * migration outright rather than quietly: an enum whose name *begins with* the
 * name of a native type is emitted without its schema prefix, so the first
 * `CREATE TABLE` using it dies on `type "…" does not exist`. See the naming rule
 * in `schemas.ts` for the one-line reason.
 *
 * The rule the schema files follow, and the spelling to use, are in
 * `src/server/db/schema/schemas.ts`. This check enforces it off the schema
 * metadata rather than out of generated SQL, so it needs no database and holds
 * under push mode and under migrations alike.
 */
import { getTableConfig, getViewConfig, isPgEnum } from "drizzle-orm/pg-core";

import * as schema from "../src/server/db/schema";

/** `NAMEDATALEN - 1`. Not changeable without recompiling Postgres. */
const LIMIT = 63;

/**
 * `pgNativeTypes`, copied verbatim from drizzle-kit 0.31.10's `parseType`
 * (`drizzle-kit/api.mjs`), because that function decides whether a column's type
 * gets its schema prefix with `pgNativeTypes.some((it) => type.startsWith(it))`.
 * A prefix match, not an equality one — so an enum called `text_direction` is
 * mistaken for the native `text`, emitted bare, and the `CREATE TABLE` fails.
 *
 * Copied rather than imported: `parseType` is not exported, and a list that
 * drifts from upstream fails safe here — a type dropped from a future drizzle-kit
 * only means this check refuses a name that would in fact have worked.
 */
const NATIVE_TYPE_NAMES = [
  "uuid",
  "smallint",
  "integer",
  "bigint",
  "boolean",
  "text",
  "varchar",
  "serial",
  "bigserial",
  "decimal",
  "numeric",
  "real",
  "json",
  "jsonb",
  "time",
  "timestamp",
  "date",
  "interval",
  "double precision",
  "char",
  "vector",
  "geometry",
  "halfvec",
  "sparsevec",
  "bit",
];

type Identifier = {
  name: string;
  /** What the name names, for the report. */
  kind: string;
  /**
   * The namespace Postgres requires this name to be unique inside. Two names
   * collide only when they truncate alike *and* share one of these, so the
   * scope has to be real: tables, indexes, views and enum types share a schema
   * (every relation gets a row in `pg_type` too), while constraints, columns and
   * policies are each unique per table and never against each other.
   */
  scope: string;
};

const identifiers: Identifier[] = [];
const add = (kind: string, scope: string, name: string | undefined) => {
  if (name) identifiers.push({ kind, scope, name });
};

const schemaNames = new Set<string>();
/** Kept apart from `identifiers`: only enum names carry the third rule. */
const enumNames: string[] = [];

for (const value of Object.values(schema)) {
  if (isPgEnum(value)) {
    const namespace = value.schema ?? "public";
    schemaNames.add(namespace);
    add("enum", `relation in ${namespace}`, value.enumName);
    enumNames.push(value.enumName);
    continue;
  }

  let table;
  try {
    table = getTableConfig(value as never);
  } catch {
    try {
      const view = getViewConfig(value as never);
      const namespace = view.schema ?? "public";
      schemaNames.add(namespace);
      add("view", `relation in ${namespace}`, view.name);
    } catch {
      // Not a table, view or enum — a helper, a type, a relation definition.
    }
    continue;
  }

  const namespace = table.schema ?? "public";
  const qualified = `${namespace}.${table.name}`;
  const relation = `relation in ${namespace}`;
  const constraint = `constraint on ${qualified}`;
  schemaNames.add(namespace);

  add("table", relation, table.name);
  for (const index of table.indexes) add("index", relation, index.config.name);
  for (const column of table.columns)
    add("column", `column of ${qualified}`, column.name);
  for (const key of table.foreignKeys)
    add("foreign key", constraint, key.getName());
  for (const key of table.primaryKeys)
    add("primary key", constraint, key.getName());
  for (const unique of table.uniqueConstraints)
    add("unique", constraint, unique.name);
  for (const check of table.checks) add("check", constraint, check.name);
  for (const policy of table.policies)
    add("policy", `policy on ${qualified}`, policy.name);

  // Postgres, not drizzle, names the key of a table that declares its primary
  // key inline on the column: `{table}_pkey`. Drizzle never writes or compares
  // that name, so it cannot churn — but it can still truncate into a collision.
  if (table.primaryKeys.length === 0 && table.columns.some((c) => c.primary)) {
    add("primary key (implicit)", constraint, `${table.name}_pkey`);
  }
}

for (const name of schemaNames) add("schema", "database", name);

const width = (name: string) => Buffer.byteLength(name, "utf8");
/**
 * Postgres truncates on a character boundary (`pg_mbcliplen`), not a byte one.
 * Every identifier here is ASCII, so the two agree; the byte slice is the
 * conservative reading if one ever is not.
 */
const truncate = (name: string) =>
  Buffer.from(name, "utf8").subarray(0, LIMIT).toString("utf8");

const over = identifiers
  .filter((id) => width(id.name) > LIMIT)
  .sort((a, b) => width(b.name) - width(a.name));

const byScope = new Map<string, Map<string, Set<string>>>();
for (const id of identifiers) {
  const scope = byScope.get(id.scope) ?? new Map<string, Set<string>>();
  const names = scope.get(truncate(id.name)) ?? new Set<string>();
  names.add(id.name);
  scope.set(truncate(id.name), names);
  byScope.set(id.scope, scope);
}
const collisions = [...byScope].flatMap(([scope, names]) =>
  [...names]
    .filter(([, group]) => group.size > 1)
    .map(([shared, group]) => ({ scope, shared, group: [...group] })),
);

const shadowed = enumNames
  .map((name) => ({
    name,
    native: NATIVE_TYPE_NAMES.find((type) => name.startsWith(type)),
  }))
  .filter((entry): entry is { name: string; native: string } =>
    Boolean(entry.native),
  )
  .sort((a, b) => a.name.localeCompare(b.name));

if (over.length > 0) {
  console.log(
    `${String(over.length)} identifier(s) over ${String(LIMIT)} bytes:\n`,
  );
  for (const id of over) {
    console.log(`  ${String(width(id.name))}  ${id.kind}  ${id.name}`);
    console.log(`      becomes  ${truncate(id.name)}`);
  }
  console.log(
    "\nName these explicitly in the table's extras. The rule is in" +
      " src/server/db/schema/schemas.ts.\n",
  );
}

if (collisions.length > 0) {
  console.log(
    `${String(collisions.length)} name(s) that would collide once truncated:\n`,
  );
  for (const collision of collisions) {
    console.log(`  one ${collision.scope} named ${collision.shared}`);
    for (const name of collision.group) console.log(`      from  ${name}`);
  }
  console.log("");
}

if (shadowed.length > 0) {
  console.log(
    `${String(shadowed.length)} enum name(s) that drizzle-kit will emit` +
      " without a schema prefix:\n",
  );
  for (const entry of shadowed) {
    console.log(`  ${entry.name}  reads as the native "${entry.native}"`);
  }
  console.log(
    "\nRename so the name does not start with a native type: the generated" +
      '\n`CREATE TABLE` would fail on `type "…" does not exist`. The rule is in' +
      " src/server/db/schema/schemas.ts.\n",
  );
}

console.log(`identifiers checked: ${String(identifiers.length)}`);
console.log(`over ${String(LIMIT)} bytes: ${String(over.length)}`);
console.log(`truncation collisions: ${String(collisions.length)}`);
console.log(
  `enums shadowed by a native type: ${String(shadowed.length)}` +
    ` (of ${String(enumNames.length)})`,
);

// Headroom, so the next long name is a known risk rather than a surprise.
const tightest = identifiers
  .filter((id) => width(id.name) <= LIMIT)
  .sort((a, b) => width(b.name) - width(a.name))
  .slice(0, 5);
console.log(`\ntightest headroom, of ${String(LIMIT)} bytes:`);
for (const id of tightest) {
  const spare = LIMIT - width(id.name);
  const room = spare === 0 ? "none" : `${String(spare)} byte(s)`;
  console.log(`  ${String(width(id.name))}  ${room} spare  ${id.name}`);
}

if (over.length > 0 || collisions.length > 0 || shadowed.length > 0) {
  process.exit(1);
}
