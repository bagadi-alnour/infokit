# InfoKit — Schema Delivery Plan

> `PRODUCT.md` is authoritative for scope. `DATABASE-SCHEMA.md` is the design
> proposal. This file is the **order of work**: how the 154 tables that exist
> today become the ~236 that Phase 4 needs, and what has to be true of the
> database before any of it reaches a persistent environment. It records
> decisions; it does not expand scope.

## Where the schema stands — measured 28 July 2026, Stage 2 tables in

Against the local Docker database on port 5433, in push mode — which is how the
schema was built and is no longer how it is applied; the reviewed migration chain
replaced it on 29 July 2026 (§0.3). The "was" column is the same measurement taken
before Stage 2's fourteen tables landed, so the cost of the stage is readable
rather than asserted:

| Fact                         | Value                                                                                                       | Was        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| Tables                       | **154** — `content` 82, `core` 30, `operations` 14, `simulator` 13, `auth` 10, `notifications` 4, `audit` 1 | 140        |
| Enums                        | 67, **all in `public`** rather than their domain schema                                                     | 57         |
| Foreign keys                 | 389 — 168 `no action`, 154 `cascade`, 57 `restrict`, 10 `set null`                                          | 338        |
| Composite tenant FKs         | 19 (city teams, members, providers, scope-keyed tags and services, Stage 2's five)                          | 14         |
| `CHECK` constraints          | 90                                                                                                          | 68         |
| Partial unique indexes       | 39 — Stage 2 leans on these where a plain unique would enforce nothing over nulls                           | 32         |
| Tables with RLS enabled      | **0**. Policies: **0**                                                                                      | 0          |
| Triggers                     | **0** — `updated_at` is Drizzle `$onUpdate`, application-side only                                          | 0          |
| Views / materialized views   | **0**. No `public_api` schema                                                                               | 0          |
| Extensions                   | `plpgsql` only — no `pgcrypto`, `unaccent`, `pg_trgm`                                                       | same       |
| Migrations                   | No `apps/web/drizzle/` directory. No baseline                                                               | same       |
| Generated columns            | 2 — `core.tags.scope_key`, `content.services.scope_key`                                                     | 2          |
| Constraint names at 63 chars | **50** — silently truncated by push, so they never match the schema again (see 0.3)                         | unmeasured |
| FKs with no leading index    | **243 of 389** — Stage 0.9's sweep grew with the stage                                                      | 215 of 338 |

Schemas `documents` and `inventory` do not exist and are not declared in
`schema/schemas.ts`.

### What the design doc names and the database does not have

83 tables and one materialized view remain — 96 before Stage 2. Excluded from that count are the
rows `DATABASE-SCHEMA.md` explicitly supersedes — `core.member_skills`,
`operations.member_skills`, `operations.member_languages`,
`operations.driving_permit_categories`,
`operations.driving_permit_category_translations`,
`operations.member_driving_permits` — which are retired vocabulary, not debt.

| Schema          | Missing | What                                                                                                   |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `content`       | 19      | Joint-publication engine (12), tag joins (4), audience policy, translation provenance, search aliases  |
| `operations`    | 20      | Teams, member profiles, availability, absences, private calendar, assignments, imports, workspace tags |
| `inventory`     | 29      | Whole schema                                                                                           |
| `documents`     | 9       | Whole schema                                                                                           |
| `core`          | 2       | Member types and engagements                                                                           |
| `notifications` | 1       | Outbox                                                                                                 |
| `auth`          | 2       | Passkey authenticators, recovery codes                                                                 |
| `audit`         | 1       | `restricted_access_events`                                                                             |

### Divergences to reconcile, not just fill

The schema is the source of truth (`AGENTS.md` rule 1), so where the database
and the doc disagree, one of them is edited — neither is left ambiguous.

1. ~~**`auth.users.id` is `varchar(255)`**, not `uuid`.~~ **Closed 29 July 2026**
   by 0.1: `uuid` in the schema and in the database, with the 79 columns that
   reference it. The measurement said 73; the count is 79, because two columns do
   not carry an obvious actor name (`content.review_tasks.assignee_id`,
   `core.moderation_cases.assigned_to_id`) and were found by following the foreign
   keys rather than the naming.
2. **`content.public_events` collapses the audience policy into columns**
   (`audience_category_id`, `min_age`, `max_age`) while
   `public_event_audience_translations` foreign-keys the _event_, not a policy
   row. §7 and §20 ("exactly one active audience policy") describe a separate
   table. Activities already work the same collapsed way, so the likely
   resolution is amending §7 to match — but §20's publication gate has to be
   restated as a `not null` column check rather than a row's existence.
3. **`auth.device_grants` exists and the doc never mentions it.** §4 gains a row.
4. **`translation_provenance` is absent because its columns are inline** on
   `activity_translations` and `editorial_revision_translations` (method,
   provider job, content hash, verified by/at) plus a
   `translation_review_stage` enum the doc does not describe. Amend §8 to the
   implemented shape rather than adding a table nothing needs.
5. **`preferred_sign_in_method` offers `passkey`** and no `auth.authenticators`
   table exists to store one. Either the enum value waits or the table lands.
6. **`content.places` has zero `CHECK` constraints** — `lat`/`lng` are
   unvalidated `double precision`, and nothing pairs them.
   Stage 2 opened two more and closed them in the same pass, since the rule above
   says the doc is what moves:

7. **Moderation landed in `core`, not `content`** — platform-only governance
   about organisations, beside `core.permission_reviews`, with a polymorphic
   subject precisely because it is not one content type. §11 amended.
8. **A cancelled occurrence's reason is a translation row, not a column.** §13
   listed "visible reason" on `coordination_event_occurrences`; the built schema
   has `operations.coordination_event_occurrence_translations`, mirroring
   `content.public_event_occurrence_translations`, because a cancellation is read
   by exactly the people least able to read French. §13 gained the row and lost
   the column.

## Decisions taken

| #      | Decision                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | `auth.users.id` becomes `uuid`, and every referencing column with it, **now** — while the local database is disposable and no baseline migration exists. Later it is a 79-column rewrite against live data. **Landed 29 July 2026** (0.1).                                 |
| **D2** | The public read model becomes a real `public_api` schema of read-only views plus a database role that can see nothing else. The never-public invariant (`AGENTS.md` rule 4) stops being a code-review promise. The app-side payload modules stay, and read from the views. |
| **D3** | No PostGIS. `lat`/`lng` stay, gain range and pairing `CHECK`s, and PostGIS remains a documented upgrade that does not change the public contract. Radius search is behind an evidence gate anyway (`PRODUCT.md` §8.1).                                                     |
| **D4** | RLS lands in Stage 0, with the baseline — not at Phase 2. Retrofitting policies over the 42 tenant tables that exist today, plus every one Phases 2–4 add, _and_ the session-variable discipline in every server action, is the more expensive order.                      |

Recorded 28 July 2026. D1–D4 amend `DATABASE-SCHEMA.md` §4, §7, §18 and §19;
that edit is part of Stage 0, not a follow-up.

**Open:** **D5** — how organisation departure is recorded (FR-P2-014). Two
tables or documented-as-derived; see 2.4. It blocks one Phase 2 requirement and
nothing in Stage 0 or 1, so it is the one decision this plan leaves for the
stage that needs it.

---

## Stage 0 — Production foundations

**Everything here precedes the first persistent environment.** After the
baseline exists, each item below costs a migration against live data instead of
a schema edit against an empty one. This is the whole reason the stage exists.

### 0.1 Identifier type unification (D1) — **landed 29 July 2026**

`auth.users.id` is `uuid("id").defaultRandom()`, and the 79 columns that
reference it are `uuid`: `actor_user_id`, `created_by_id`, `verified_by_id`,
`uploader_id`, `author_id`, `granted_by_id`, `published_by_id` and the rest,
`auth.user_settings.user_id`, `core.organization_members.user_id`,
`core.translators.user_id` and `notifications.*.user_id` included.
`audit.events.subject_id` stays `varchar` — §17 allows it, and subjects are not
all UUIDs.

Two things this predicted turned out otherwise, both worth keeping written down:

- **No adapter change was needed.** `@auth/drizzle-adapter` asks the id column
  whether it `hasDefault` and lets the database mint the value when it does, so
  `defaultRandom()` is the whole of it. Nothing in the application typed a user
  id as anything but `string`, which is what drizzle calls a `uuid` too, so
  `tsc` was silent before and after — that silence is the reason 0.1 needed a
  database-level check rather than a typecheck.
- **The count was 73, and it is 79.** The gap is columns named for the job
  rather than the actor (`review_tasks.assignee_id`,
  `moderation_cases.assigned_to_id`); following `references(() => users.id)`
  finds them and a name pattern does not.

Verified by `apps/web/scripts/schema-drift.ts` (`pnpm db:drift`), which now
compares column **types** as well as presence, and by asking the live catalogue
directly: every foreign key into `auth.users` is `uuid`, 79 of 79. The type
comparison is what makes this checkable at all — a schema that says `uuid` over
a database that says `varchar(255)` reads and writes correctly until the first
value that does not fit.

The database was then dropped, recreated as `infokit`, pushed and reseeded — the
local database is disposable, so there is no migration for any of this.

### 0.2 Extensions and a migration-owned bootstrap — **landed 29 July 2026**

`0001_extensions_and_partitions.sql` installs `pgcrypto`, `unaccent` and
`pg_trgm`, and creates `public_api`; `0000` creates the eight domain schemas. No
PostGIS (D3) — coordinates stay two numeric columns until something needs real
geometry. The extensions landed ahead of the feature that wants them because a
hosting provider that cannot install them is something to discover before launch,
not after: all three are on RDS's allowlist, so the migration needs no cloud
variant. `pgcrypto` is there for digest/HMAC in the database, **not** for
`gen_random_uuid()` — that has been core since PG13, so do not read the default on
every `id` column as a dependency on the extension.

### 0.3 Baseline migration and the discipline around it — **landed 29 July 2026**

Four migrations, and together they build the current schema from an empty
database. `0000` is generated; the other three are `--custom`, which is the
pattern `ENGINEERING-NOTES.md` §4 identifies as the best find — hand-written SQL
for database-level enforcement, numbered alongside the generated ones.

| File                                 | Carries                                                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0000_baseline.sql`                  | The eight domain schemas, every table, 67 enums and 383 foreign keys — plus 0.11 (each enum inside its own domain schema) and 0.12's `PARTITION BY RANGE` on `audit.events` |
| `0001_extensions_and_partitions.sql` | 0.2: `pgcrypto`, `unaccent`, `pg_trgm`, the empty `public_api` schema, and 18 monthly partitions of `audit.events` plus `events_default`                                    |
| `0002_roles.sql`                     | 0.4: `infokit_app` at `CONNECTION LIMIT 90`, its grants, `ALTER DEFAULT PRIVILEGES` for future tables, and `REVOKE UPDATE, DELETE` on the eight append-only tables          |
| `0003_append_only_columns.sql`       | The five column-level `GRANT UPDATE`s that 0002's table-level revoke was too coarse to express — freshness metadata and an unsealed translation snapshot                    |

One clean baseline, not a replay of push-mode history: the database was dropped
and rebuilt from the chain rather than migrated into agreement with itself, and
`pnpm db:drift` reports no drift against the result.

The discipline, now enforced rather than remembered:

- **Never edit an applied migration.** The journal stores a hash of the file's
  contents and the migrator decides what to apply by timestamp, so an edit does
  not re-run — it just makes the record of what ran disagree with what is on
  disk. `0003` exists because of this rule, not despite it: it is the correction
  to `0002` that an edit would have hidden.
- **`pnpm db:push` is guarded**, not documented-against. `apps/web/scripts/db-push-guard.ts`
  refuses a target that is not this machine — catching a production endpoint
  before a socket opens — and refuses any database where
  `drizzle.__drizzle_migrations` exists. What survives is the one case push is
  still for: a throwaway local database, never migrated, used to try a schema
  shape out before committing to a migration for it. Verified both ways, and the
  scratch case really does still push.
- ~~Add `db:drift` to `apps/web/package.json`~~ — done with 0.1; running it in
  `check:ci` is still open, and needs a database in CI to be worth anything.
- A remote apply is `ENV_FILE=.env.prod.local pnpm db:migrate:remote`, which
  refuses to run without an explicit env file rather than defaulting to one.
  `drizzle.config.ts` now carries `ssl` from `src/server/db/ssl.ts`, so that
  connection gets `verify-full` — it holds the owner password, the one credential
  that can drop the schema.

**Three ways `db:generate` produces SQL that will not apply.** All three were met
while writing `0000`, and none is visible in the TypeScript:

| Hazard                                                                                                                                                                                                                                                             | Why it fails                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **An enum whose name starts with a native type name.** drizzle-kit 0.31.10 decides whether to schema-qualify a column type with `pgNativeTypes.some((it) => type.startsWith(it))` (`parseType`), so `text_direction` is read as the native `text` and emitted bare | `CREATE TABLE` fails with `type "text_direction" does not exist`, because the type really lives in a schema. `writing_direction` and `asset_text_track_kind` are named around it; `pnpm db:names` fails on a new one |
| **Every foreign key is emitted before every `CREATE UNIQUE INDEX`** — in `0000`, all 383 of them by line 2450, the first unique index at line 2458                                                                                                                 | A composite foreign key whose target is a `uniqueIndex()` has no unique to reference yet. Every composite target in the schema is a table-level `unique()` instead, which lands inline with `CREATE TABLE`           |
| **Generated constraint names longer than 63 characters** get silently truncated                                                                                                                                                                                    | The name in the database stops matching the schema. `pnpm db:names` reports 0 over budget and 0 truncation collisions, which is the check that keeps this from recurring                                             |

The second hazard has a forward-looking twin that `0000` could not show, because
a baseline only ever creates tables. In a migration that **alters** existing ones,
`jsonAddedUniqueConstraints` is emitted after `jsonCreatedReferencesForAlteredTables`:
add a `UNIQUE` constraint and a foreign key that depends on it in the same
`db:generate`, and the foreign key comes first and fails. Same for a new foreign
key whose only candidate target is a `uniqueIndex()`. Both are reorder-by-hand
cases — move the unique above the foreign key in the generated file **before**
applying it, which is not editing an applied migration but finishing an unapplied
one. This is the only remaining reason to read generated SQL for _ordering_ rather
than just for correctness.

The four `drizzle-kit push` limits below are now **historical** — they shaped the
schema files while push built the database, and the baseline is where they stop
mattering. The fifth is resolved outright. Kept because two of them explain why
the schema is shaped the way it is:

| Limit                                                                           | What it does                                                                                                               | What Stage 2 did about it                                                                            |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Generated constraint names longer than Postgres's 63-character identifier limit | Get silently truncated, so the name in the database never matches the schema again and push drops and re-adds it every run | Every foreign key on a long-named new table is named explicitly in the extras                        |
| Push emits all foreign keys **before** any unique constraint or index           | A composite key whose target unique does not already exist fails on a fresh create                                         | No new composite key points at a unique introduced in the same push                                  |
| Push re-creates some composite unique constraints on every run                  | Once a foreign key depends on one, the `DROP` fails and every later push aborts — the database becomes unpushable          | The one key that needed such a target was reduced to a single column, with the pair invariant in 2.3 |
| Push re-creates **every** composite primary key on every run — 21 tables today  | Harmless in itself, but it is noise that hides a real diff, and it is not fixable by naming the constraint                 | Nothing. Named the one new composite key anyway, so the database name matches the schema             |

A fifth followed from the third and was the reason the baseline could not wait:
when push re-creates a composite unique on a table, it first drops **every**
composite foreign key pointing at that table. `core.organization_members` had one
such churning unique, so seven composite keys — four pre-existing, three from
Stage 2 — were dropped and re-added on every run. It worked, and it was one
failed drop away from not working. `0000` states all seven once and nothing
re-creates them, so the failure mode is gone rather than avoided.

**How the chain is verified**, and it is worth reusing when a second environment
appears: apply it to two databases in the same cluster and diff
`pg_dump --schema-only` between them. Identical across 13,207 lines including all
183 `GRANT`/`REVOKE` lines. One filter is required —
`grep -vE '^\\(un)?restrict '` — because pg_dump 18 emits `\restrict` /
`\unrestrict` with a per-dump random nonce. Filter those two lines rather than
reaching for `--no-acl`, which would drop exactly the privilege lines that most
need comparing. Applying to a second database in the same cluster is also the
only thing that exercises `0002`'s `CREATE ROLE` guard, since roles are
cluster-scoped while the journal is per-database.

### 0.4 Database roles, and the split §18 requires — **`infokit_app` landed 29 July 2026**

Four roles, created in migration, never the same as the owner:

| Role             | Sees                                                    | Notes                                           |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `infokit_owner`  | Everything                                              | Migrations only. Bypasses RLS — never the app's |
| `infokit_app`    | Tenant tables under RLS                                 | The web application. `NOBYPASSRLS`              |
| `infokit_reader` | `public_api` views only                                 | Anonymous public reads                          |
| `infokit_worker` | Outbox, notifications, projections; sets tenant context | Background jobs                                 |

`0002_roles.sql` created `infokit_app` — the one role the running application
needs — and revoked `UPDATE`/`DELETE` on the eight append-only tables, so 0.7's
triggers are a second line rather than the only one: `audit.events`,
`content.activity_verifications`, `content.activity_occurrence_confirmations`,
`content.activity_custody_events`, `content.editorial_revisions`,
`content.translation_source_versions`,
`content.translation_assignment_events`, `notifications.delivery_attempts`.
`infokit_reader` and `infokit_worker` wait for the migration that first gives
them something to read or a job to run; `infokit_owner` stays the `postgres`
master role until there is a reason to separate them.

**Two of the eight needed column-level grants, and `0003_append_only_columns.sql`
is where the distinction lives.** They are append-only in their _content_ and
mutable in their _annotations_, which a table-level revoke cannot say:

| Table                                 | Granted `UPDATE`                                           | Why                                                                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content.editorial_revisions`         | `can_become_outdated`, `unreliable_from`, `source_summary` | The dated public-warning state (FR-P1-009/010) changes on a revision that already exists; publishing a new one to mark an old one unreliable would inflate `revision_number` for something nobody authored |
| `content.translation_source_versions` | `source_content_json`, `source_content_hash`               | Rewritten in place while the revision it points at is still unsealed; a save that _is_ a new revision appends a row instead                                                                                |

`revision_number`, `version`, the version-chain pointers and `DELETE` on both
stay refused, and the other six take no `UPDATE` or `DELETE` anywhere in `src/`.
Two consequences worth carrying: `ALTER DEFAULT PRIVILEGES` cannot express a
column-level grant, so a migration that ever drops and recreates either table has
to repeat these; and the append-only guarantee on
`translation_source_versions` is really _per revision_, which no privilege can
express — 0.7's triggers, keyed on whether the source revision is sealed, are the
durable answer for both tables.

Verified behaviourally rather than by reading the catalogue: as `infokit_app`, in
rolled-back transactions, both intended `UPDATE`s succeeded on real rows while
`revision_number`, `version`, both `DELETE`s and every write to `audit.events`
were refused. A catalogue sweep then confirmed no table-level `UPDATE`/`DELETE`
on any of the eight with `SELECT`/`INSERT` intact, and column privileges on
exactly those five columns.

### 0.5 Row-level security (D4)

Enable RLS on every organisation-scoped table, with the §18 policy over
`current_setting('app.organization_id', true)`. Then the three documented
exceptions, each as a named policy so the reason is readable in
`pg_policies` — inter-organisation coordination events on the
`inter_organisation` tier, joint-publication bundles for a party organisation,
and cross-organisation transfers and custody requests for their two parties.
Platform-owned rows (`organization_id is null`) get an explicit policy rather
than falling through a null comparison.

**Do not derive the table list from the column name.** 39 tables carry
`organization_id`, but eight more reference `core.organizations` under another
name and they do not all mean the same thing:

| Table                                                                | Column                    | Treatment                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `operations.coordination_events`                                     | `host_organization_id`    | Tenant-scoped. Missing it would leave Phase 2's central table unprotected                                                   |
| `core.translators`, `simulator.flows`                                | `owner_organization_id`   | Tenant-scoped                                                                                                               |
| `content.activity_claim_requests`, `content.activity_custody_events` | two org columns each      | **Two-sided predicate** — visible to source _and_ destination. Not a single-column match, and one of §18's three exceptions |
| `auth.user_settings`                                                 | `default_organization_id` | **Not** tenant scope. It is a user preference; RLS here is user-scoped or the setting becomes unreadable                    |

So the real count is 42 single-predicate tenant tables, 2 two-sided, and 1
deliberate exclusion — enumerated explicitly in the migration, never generated
from `information_schema`. A policy list built by column-name convention is a
list with a silent hole in it.

Two things have to land with it or RLS is theatre: a single transaction helper
that sets `app.organization_id` and `app.user_id` on every request, and a test
that asserts a query without that context returns zero rows. Session pooling in
transaction mode is compatible because `set_config(..., true)` is
transaction-local — but that is a property to test against the chosen host, not
assume.

### 0.6 `public_api` (D2)

One view per anonymous surface, each selecting only published, non-archived
rows and never `steward_name`/`steward_phone`/`steward_email`:
`organization_profiles`, `activity_search`, `activity_occurrences`,
`public_events`, `editorial_content`, `downloads`, `simulator_versions`,
`coordination_events` (`visibility = 'public'` only). `infokit_reader` gets
`SELECT` on the schema and nothing anywhere else.
`apps/web/src/server/content/public-activity-payload.ts` keeps its job of
shaping the payload; it changes which relation it reads.

`public_api.search_suggestions` is deliberately not built here — it waits with
autocomplete for its evidence trigger.

### 0.7 Database-level immutability

Application promises are not immutability. Triggers, per
`ENGINEERING-NOTES.md` §4:

- `audit.events` — reject `UPDATE` and `DELETE` outright.
- Immutable revisions and sealed bundles — reject `UPDATE` on
  `content.editorial_revisions`, `content.translation_source_versions`, and
  (when Stage 1 builds them) `publication_snapshots` and
  `publication_approval_bundles` once `sealed_at` is set.
- Append-only evidence — reject `UPDATE`/`DELETE` on the verification,
  confirmation, custody and assignment-event tables.
- The same trigger shape is what `inventory.movement_lines` will need in
  Stage 4; write it once, reusably.

### 0.8 `updated_at`, in the database

`$onUpdate` covers Drizzle writes and nothing else — a seed, a repair script or
a psql session leaves the column lying. One `set_updated_at()` trigger function,
attached to every table carrying the column.

### 0.9 The index sweep

215 foreign keys have no index leading with their columns. They are not equally
worth fixing, so three passes rather than a blanket 215:

1. **Cascade and restrict parents** — any FK whose parent can be deleted or
   archived needs the child index or the delete scans. Everything referencing
   `core.organizations`, `core.organization_members`, `content.activities`,
   `content.editorial_entries`, `content.assets`.
2. **Reverse lookups the product performs** — `language_code` on every
   translation table (the `(parent_id, language_code)` unique index cannot serve
   a language-first scan, and "what is missing in Pashto?" is a real screen),
   `city_id`, actor columns feeding the audit console.
3. **The §20 list, explicitly** — activity category/status/place, occurrence and
   schedule date ranges, `audit.events` on `(organization_id, occurred_at desc)`
   and `(subject_type, subject_id, occurred_at desc)` plus the partial
   `occurred_at where outcome <> 'success'`, and the four delivery-attempt
   indexes including `recipient_hash`.

Everything left after those three passes gets a one-line comment in the schema
file saying why it has no index, so the next audit does not rediscover it.

### 0.10 The constraint sweep

`content.places` gains `lat between -90 and 90`, `lng between -180 and 180`,
and a both-or-neither pairing check. Then walk §20's list against the 68
constraints that exist and add what is missing — start/end ordering, non-negative
capacity, weekday ranges, exactly-one-target rules. §20 is a specification; it
should be a test that reads the catalog, not a paragraph somebody rereads.

### 0.11 Enum placement — **landed 29 July 2026**

All 67 enums declare their own domain schema (`src/server/db/schema/schemas.ts`),
so `public` is gone from `drizzle.config.ts`'s `schemaFilter`. The placement rule:
the schema of the only domain that uses the enum, `core` when more than one does.
Two are shared today — `transit_mode` (content + operations) and
`translation_state` (content + simulator).

This is also what surfaced the `parseType` hazard in 0.3: push never
schema-qualified an enum type, so the move only became visible when migrations
started emitting them. It cost `apps/web/scripts/schema-drift.ts` a change too —
`format_type` answers `core.writing_direction` where drizzle's `getSQLType()` says
`writing_direction`, and all 67 read as false mismatches until the drift report
qualified its own side.

### 0.12 Audit retention and growth — **partitioning landed 29 July 2026, the number does not exist yet**

`audit.events` and `notifications.delivery_attempts` are the two tables that
grow without a business lifecycle to bound them, and both hold personal data
(§17: `ip_address` and `user_agent` "carry this table's retention policy rather
than living forever").

`audit.events` is now `PARTITION BY RANGE ("occurred_at")` with 18 monthly
partitions through 2027-12 and a `DEFAULT` partition — declarative range
partitioning was nearly free to adopt at zero rows and would have been a
migration with downtime at ten million. Partitioning forced the primary key to
become composite (`id`, `occurred_at`), which in turn made
`notifications.delivery_attempts` carry `audit_event_occurred_at` so its foreign
key can name the partition key; see `DATABASE-SCHEMA.md` §17.

Three things this leaves open, and the first two are operational rather than
schema work:

- **Somebody has to create 2028's partitions.** The bound is deliberate: an
  open-ended loop would have hidden the obligation. Extending it is the same
  block with two new dates, in a new migration.
- **Alarm on `audit.events_default`.** Its correct row count is always 0. Rows
  there mean a month is missing, and moving them into a real partition afterwards
  needs a lock and a copy — the cheap fix is noticing first. It exists so that a
  missed month is a signal instead of an outage, because a partitioned table with
  no matching partition rejects the insert and an audit write that throws takes
  the audited action down with it.
- **The retention policy is still not a number.** Write it in §17. Note the
  coupling it has to resolve: dropping an expired month is a three-step operation
  (null the referencing pointers, `DETACH PARTITION`, `DROP TABLE`) because
  `delivery_attempts` points into this table, and `DROP … CASCADE` "solves" it by
  dropping the foreign key itself. A ledger retention window no shorter than this
  table's makes the whole problem disappear.

### 0.13 Doc reconciliation

Amend `DATABASE-SCHEMA.md` for D1–D4 and divergences 2–6, add `auth.device_grants`
to §4, and run the cross-document consistency check `AGENTS.md` rule 7 requires.

**Stage 0 exit:** `check:ci` green, `db:drift` clean, baseline generated, a test
proving a context-free query returns nothing, a test proving `infokit_reader`
cannot reach a draft row, and `DATABASE-SCHEMA.md` describing the database that
exists.

---

## Stage 1 — Phase 1 completion (gate G2)

22 tables and one materialized view, but **only five of them ship on schedule**.
The rest are behind the evidence triggers `PRODUCT.md` §8.1 names, and this plan
does not quietly build past a gate.

### Ships with Stage 1

| Table                       | Why now                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notifications.outbox`      | §16's rule — never send before the transaction commits — is unenforceable without it, and invitations and sign-in codes already send. This is production correctness, not a Phase 2 feature. |
| `content.organization_tags` | `core.tags` and its translations exist; four of the eight typed join                                                                                                                         |
| `content.service_tags`      | tables from §6 do not, so tags are half-built. Cheap, additive, and it                                                                                                                       |
| `content.public_event_tags` | closes the gap rather than leaving a partial feature.                                                                                                                                        |
| `content.asset_tags`        |                                                                                                                                                                                              |

Plus the reconciliation decisions from divergences 2, 4 and 5 — audience policy,
translation provenance, passkey tables — each of which resolves to either one
table or one doc edit. Resolve them here; do not carry them into Phase 2.

### Behind its evidence trigger — "two organisations request one co-published record"

The 12-table joint-publication engine: `publication_snapshots`,
`publication_approval_bundles`, `publication_bundle_snapshots`,
`publication_bundle_assets`, `publication_parties`,
`publication_party_fragments`, `publication_approval_requests`,
`publication_approval_decisions`, `publication_approval_messages`,
`publication_approval_events`, `publication_snapshot_parties`,
`active_publications`.

This is the largest single piece of unbuilt Phase 1 design and the one most
likely to be built too early. It needs, when it comes: canonicalized manifest
hashing, a sealed-bundle immutability trigger (0.7 already has the shape), the
party-scoped RLS exception (0.5 already has the policy slot), and the idempotent
projection transaction of §11. Note that `content.activity_publications`,
`editorial_publications` and `public_event_publications` already do per-locale
pointing without it — so the engine adds multi-organisation approval, not
publication itself. That is exactly why it can wait.

### Behind its evidence trigger — "pilot users demonstrably fail with browse + filter"

`content.organization_search_aliases` and the `public_api.search_suggestions`
materialized view, with the `unaccent`/`pg_trgm`/`tsvector` indexes §19
describes. 0.2 installs the extensions so this is a build, not a
provisioning negotiation.

---

## Stage 2 — Phase 2, association onboarding

**Gate G3: two active workspaces and Stage B backing (`SUSTAINABILITY.md` §2).**
Roadmap slice 3 is "Phase 2 lite" — pilot organisations upgraded in place;
remaining Phase 2 is slice 4+, each feature on its own trigger.

14 tables. This is the stage where RLS stops being defence in depth and becomes
the product — FR-P2-004, every private record scoped to one organisation unless
explicitly platform-owned — and the first stage that migrates **rows that
already exist** rather than only adding structure.

**Built 28 July 2026** in `apps/web/src/server/db/schema/`, pushed to the local
database, and verified three ways: `db:push` runs twice with no diff on the second
pass, the catalogue reports every table, key, CHECK and index the files declare,
and every invariant in 2.3 marked shipped was exercised against the running
database in a rolled-back transaction — each one rejecting the row it should and
accepting the row it should. What is _not_ done is everything Stage 2 owes beyond
its tables: the RLS policies, the grants, the two triggers, the 2.2 data
migration, and the 2.6 tests.

Stage 2 follows the rule this plan now states once and applies everywhere:
_design globally, migrate incrementally, enforce each phase completely._ Its
policies, grants, indexes and tests ship in the same migrations as its tables.
There is no "add the tables now, harden them later" step.

### 2.0 What Phase 2 inherits

Phase 2 is not 14 tables from nothing. Slice 0 and Phase 1 already built most of
its substrate, and reading Stage 2 as a greenfield stage is the fastest way to
duplicate something:

| Already present                                                                                                             | Phase 2 requirement it serves                        |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `core.invitations`, `core.invitation_roles`, `core.organization_verifications`                                              | FR-P2-001, 003, 011 — invitation-only onboarding     |
| `core.organizations.claimed_at`, `publishing_suspended`, `status` (`draft`/`verified`/`suspended`/`archived`)               | Journey P2-A claim rule; FR-P2-013 suspension        |
| `content.editorial_custodianships` — a period table with a partial unique on `(entry_id) where ended_at is null`            | FR-P2-019/020 — exactly one maintainer at a time     |
| `content.organization_specialities` with `org_specialities_one_primary_uq`                                                  | FR-P2-007 — at most one primary, verified history    |
| `content.activity_claim_requests`, `activity_custody_events`, `activity_verifications`, `activity_occurrence_confirmations` | FR-P2-026 to 029 — provisional claim and multi-party |
| `operations.coordination_events` + `_translations`, `_assets`, `_transit_links`                                             | FR-P2-023 in full, single-occurrence FR-P2-024       |
| `steward_name`/`_phone`/`_email` on all seven content roots                                                                 | FR-P2-030 — complete, no work needed                 |
| `core.tags`, `core.tag_translations`, four typed join tables (Stage 1 adds the other four)                                  | FR-P2-015/016                                        |

The single-maintainer and single-primary rules are enforced by **partial unique
indexes**, which is why the measured 68 CHECK constraints understate how much
invariant work the existing model already does. Check `pg_indexes`, not just
`pg_constraint`, before concluding a rule is missing.

Stage 2 also assumed 0.1 landed, and it now has:
`operations.coordination_events.created_by_id` is `uuid`, as is every Phase 2
column referencing an actor.

### 2.1 Tables

| Group                 | Tables                                                                                                                                                                                      | Requirement                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Editorial custody     | `content.editorial_custody_transfer_requests`, `content.editorial_custody_transfer_events`                                                                                                  | FR-P2-019, 020; Journey P2-C    |
| Public-profile change | `content.speciality_change_requests`, `content.speciality_change_items`                                                                                                                     | FR-P2-018                       |
| Governance            | `core.moderation_cases`, `core.moderation_events`, `core.permission_reviews`, `core.permission_review_items`                                                                                | FR-P2-013, 011                  |
| Coordination agenda   | `operations.coordination_event_series`, `operations.coordination_event_occurrences`, `operations.coordination_event_occurrence_translations`, `operations.coordination_event_participation` | FR-P2-024 recurrence, FR-P2-025 |
| Notification surface  | `notifications.notifications`, `notifications.endpoints`                                                                                                                                    | FR-P2-011 review queues         |

Fourteen tables, and two notes on the list as built. The moderation pair sits in
`core`, not `content`: it is platform-only governance about organisations, the
same place `permission_reviews` lives, and the subject it points at is
polymorphic precisely because it is not one content type.
`coordination_event_occurrence_translations` is the fourteenth — a cancellation
reason is prose read by exactly the people least able to read French, so it is
translated like every other reader-facing string rather than stored once.

The coordination tables are the deferred half of what Slice 0 pulled forward:
recurrence — FR-P2-024's daily briefing, entered as separate events today — and
cross-organisation participation, FR-P2-025, which the doc says needs real
workspaces. The occurrence table brings the §13 rolling-window materialization,
but **not** §13's `(host_organization_id, starts_at, ends_at)` index: the host is
not copied onto the occurrence. Denormalising it would let a tenant policy compare
a column instead of joining, and the composite key that would keep the copy honest
cannot hold — a composite foreign key with a null column is not checked at all,
and a platform-hosted event's occurrences have exactly that null. Visibility
resolves through `event_id`, which is a primary-key lookup.

### 2.2 The one real data migration

`operations.coordination_events` carries `starts_at`, `ends_at` and `all_day`
**inline on the event**, because Slice 0 needed one-off events only. Introducing
`coordination_event_series` and `coordination_event_occurrences` moves the
authoritative time out of the event row, and events already exist. This is the
first place in the plan where expand/backfill/validate/switch/contract is not
ceremony:

1. **Expand** — add both tables and a nullable `series_id`. Nothing reads them.
2. **Backfill** — one occurrence row per existing event, copying
   `starts_at`/`ends_at`/`all_day`/`status`, in batches, re-runnable.
3. **Validate** — assert every non-archived event has exactly one occurrence and
   that the copied times match, as a query that fails the migration.
4. **Switch** — readers move to occurrences. This is smaller than it sounds and
   worth knowing before the stage starts: `~/server/content/coordination-events`
   is the only reader, with one projection selecting
   `startsAt`/`endsAt`/`allDay` and three range queries filtering or ordering on
   them. The ICS route and the agenda both go through it, so the public API and
   the calendar file follow for free. The writers —
   `dashboard/events/actions.ts` and `media-actions.ts` — move in the same
   release, or a new event gets inline times nothing reads.
5. **Contract** — drop the inline columns only after a release where nothing
   read them, as a separate migration.

Do not compress this into one migration because the local database is
disposable. By G3 there are two real workspaces with real events in them, and a
plan that only works against an empty database is not a migration plan.

### 2.3 Invariants Stage 2 ships with its tables

| Invariant                                                                                                       | Mechanism                                                                                     | State   |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| One occurrence per event per start                                                                              | Unique `(event_id, starts_at)` — §13                                                          | shipped |
| One answer per organisation per thing answered about                                                            | Two **partial** uniques — `(event_id, org_id) where occurrence is null` and the mirror image  | shipped |
| Whoever answers belongs to the organisation they answered for                                                   | Composite key `(member_id, organization_id)` → `organization_members (id, organization_id)`   | shipped |
| Transfer requests expire and are single-use                                                                     | Token **hash** only (64-hex CHECK), `expires_at not null`, CHECK tying `consumed_at` to state | shipped |
| A transfer has one open request per entry                                                                       | Partial unique `(entry_id) where state = 'pending'`                                           | shipped |
| A transfer moves custody somewhere else than it already is                                                      | CHECK on destination kind vs organisation, and destination ≠ previous                         | shipped |
| A change set decided once cannot be decided again                                                               | CHECK tying `state` to `reviewed_at`/`reviewer_id` presence                                   | shipped |
| One open change set, and one open permission review, per organisation                                           | Partial uniques on the open states                                                            | shipped |
| A review item is only marked applied when the decision was `revoke`                                             | CHECK on `applied_at` against `decision`                                                      | shipped |
| One open duplicate or impersonation case per pair of organisations                                              | Partial unique on `(kind, org, related_org)`, both named, open statuses only                  | shipped |
| A closed case says what was decided, by whom, and when                                                          | CHECK tying `status` to `resolution`/`resolved_by`/`resolved_at`                              | shipped |
| One live default endpoint per person per channel                                                                | Partial unique `where is_primary and disabled_at is null`                                     | shipped |
| A bell notification never links off-site                                                                        | CHECK `link_path like '/%'`                                                                   | shipped |
| A cancelled occurrence keeps a visible translated reason                                                        | Trigger — the reason lives in the translation table, so no CHECK can see it                   | Stage 0 |
| The occurrence answered about belongs to the event answered about                                               | Trigger — the composite key this wants is unmaintainable under push (see 0.3)                 | Stage 0 |
| Custody, moderation and transfer history never change                                                           | Append-only trigger **and** revoked `UPDATE`/`DELETE` from `infokit_app`                      | Stage 0 |
| An `inter_organisation` event is readable by verified members of any organisation, an `organisation` one is not | The named 0.5 exception policy, tested from both sides                                        | Stage 0 |

The two triggers marked Stage 0 are the only Phase 2 invariants not in the
database today. Both are cross-row, so neither was ever a CHECK; write them with
0.7's triggers, and until then the service layer is the only thing holding them.

Add to 0.4's revoked-grant list: `content.editorial_custody_transfer_events`,
`core.moderation_events`, `content.editorial_custodianships`. The first two are
append-only by their own definition; the third is custody history that audit
events already reference.

`notifications.endpoints` holds encrypted addresses and tokens. **Decide the
column-encryption approach here.** `pgcrypto` is installed, but a key that lives
in the same database as the ciphertext is not encryption — it is obfuscation
with extra steps. This is the first table that forces the question, and Stage 3's
`operations.absence_reasons` and the whole `documents` schema inherit the answer.

### 2.4 Open gap — organisation departure (FR-P2-014)

FR-P2-014 requires departure to support custody handover, unpublishing and
archive, access revocation, and _configured retention_, "without rewriting
historical ownership or audit records". `DATABASE-SCHEMA.md` has no table for
this. `core.organizations.status = 'archived'` records that a departure
happened; nothing records what was **decided** — which content was handed to
whom, which access was revoked when, which retention window applies, and who
approved it.

This resolves one of two ways, and Stage 2 cannot ship FR-P2-014 until it does:

- **A `core.organization_departures` record** plus append-only
  `organization_departure_events`, mirroring the custody-transfer shape. Two
  tables, consistent with how every other irreversible decision in this schema
  is recorded.
- **Documented as derived** — the departure is reconstructible from
  `editorial_custodianships`, `activity_custody_events`, role revocations and
  `audit.events`, and the doc says so explicitly.

Recommendation: the first. "Reconstructible from the audit log" is how retention
obligations get missed, and a departure is exactly the event a regulator asks
about. Recorded here as **D5, open** — the only unresolved decision in Stage 2.

The built schema takes one step that is not the decision: `moderation_case_kind`
carries `departure` alongside `suspension`, so the platform's _handling_ of a
departure — who asked, what was found, what was decided, by whom — has a home
today. That is the case file, not the record FR-P2-014 asks for: it does not
carry the retention window, and it does not enumerate what was handed to whom.
D5 stays open.

### 2.5 Inside Phase 2, still behind its own trigger

Phase 2 arriving is not the same as every Phase 2 feature's gate opening.

- **FR-P2-017 — joint publication across every content type.** Needs the
  12-table engine from Stage 1, which waits for "two organisations request one
  co-published record". Phase 2 broadens its scope; it does not authorise
  building it. Note the ordering trap: §11.5 lists joint publication as a Phase 2
  _exit criterion_, so if the trigger has not fired by G3, the exit criterion is
  reported as not-applicable rather than quietly satisfied.
- **FR-P2-022 — workspace flyer generation.** P1, and the media processing
  pipeline is deferred on evidence in `PRODUCT.md` §8.1. The asset tables already
  exist; only the pipeline waits.
- **FR-P2-015/016 — tags.** P1. Stage 1 completes the four missing join tables,
  so Phase 2 adds management surfaces, not schema.

### 2.6 Stage 2 exit

Beyond the invariants above, three tests that only Phase 2 can run:

1. **The RLS matrix, for real.** Not one leak test — the full grid across
   anonymous, platform, organisation A, organisation B, translator, revoked, and
   role-testing contexts, asserting that organisation A's member reads an
   `inter_organisation` event and fails on organisation B's `organisation` one,
   and that a claim request is visible to both its parties and no one else.
2. **Concurrency on acceptance.** Two simultaneous accepts of one custody
   transfer produce one transfer and one rejection, not two custodianships —
   which the partial unique index should make impossible at the storage layer
   rather than in application code.
3. **Europe/Paris DST.** A daily briefing series spanning the March and October
   boundaries generates occurrences at the correct local time on both sides.
   Recurrence stores local time plus a timezone and materializes `timestamptz`;
   the two DST weekends are where that arithmetic is wrong silently, and Phase 2
   is the first stage that has recurrence to test.

---

## Stage 3 — Phase 3, team management (hard gate: a legal entity, `RISKS.md` R6)

32 tables, the largest stage, and the one that must not start early: it is the
first stage that collects real personal data about volunteers and staff.
`DATABASE-SCHEMA.md` §7 already states the rule for the member-assignment path
that exists today — before the gate, fictional labelled data only.

| Group                | Tables                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Membership history   | `core.member_types`, `core.member_engagements`                                                                                                                                                                         |
| Operational profile  | `operations.member_profiles`, `operations.profile_field_policies`                                                                                                                                                      |
| Teams                | `operations.teams`, `operations.team_members`                                                                                                                                                                          |
| Workspace tags       | `operations.member_tags`, `operations.team_tags`, `operations.calendar_event_tags`                                                                                                                                     |
| Availability         | `operations.availability_rules`, `operations.availability_exceptions`, `operations.absence_requests`, `operations.absence_reasons`                                                                                     |
| Private planning     | `operations.calendar_events`, `operations.calendar_event_occurrences`, `operations.event_requirement_sets`, `operations.event_assignments`, `operations.assignment_requirement_checks`, `operations.assignment_events` |
| Agenda import        | `operations.calendar_imports`, `operations.calendar_import_rows`, `operations.calendar_import_events`                                                                                                                  |
| Restricted documents | `documents.*` (9)                                                                                                                                                                                                      |
| Restricted access    | `audit.restricted_access_events`                                                                                                                                                                                       |

Four things make this stage load-bearing rather than mechanical:

1. **`requirement_sets` already exists and nothing points at it.** §12 built the
   catalogue, the declarations and the sets ahead of missions deliberately.
   `event_requirement_sets` is the join that finally uses them, and
   `~/lib/requirement-matching` is already the shared definition of "met" —
   so the assignment check reuses it rather than reimplementing the comparison.
2. **`documents` needs more than tenant RLS.** §18 is explicit: matching
   `organization_id` is insufficient. Every document table needs a
   security-definer access function checking the explicit document permission,
   and team membership must not grant access.
3. **`absence_reasons` and the signed files are the restricted tier.** They
   inherit Stage 2's encryption decision, and document reads generate
   `audit.restricted_access_events` under a separate retention policy.
4. **`profile_field_policies` is a consent record, not configuration.** §12: the
   API returns a field policy with each editable qualification so the client can
   state purpose, audience and retention _before_ save. Build the table and the
   API contract together or the notice never appears.

---

## Stage 4 — Phase 4, inventory (29 tables)

The whole `inventory` schema, in the §22 order: units and categories, items and
variants and identifiers, lots, locations and stock policies, then the ledger,
then reservations, kits, transfers, alerts and imports.

Three properties decide whether this schema is production-grade, and all three
are database-level:

- **The ledger is append-only.** `movement_lines` reject `UPDATE` and `DELETE`
  by trigger _and_ by revoked grant — 0.7 and 0.4 already established both.
  Corrections are compensating movements with a reason.
- **`stock_balances` is a projection, never the truth.** Maintained
  transactionally or as a materialized view; the ledger is authoritative. A
  balance that can drift from its ledger is the failure mode this whole design
  exists to prevent.
- **`numeric` everywhere, never floating point**, for quantities and unit
  factors, with dimension checks so a conversion cannot cross dimensions.

`financial_entries` is a separate permission (`inventory.financial.read`), so it
is a separate table with its own policy rather than a nullable cost column.
Cross-organisation transfers reuse the party-scoped exception pattern from 0.5
for a third time — the shape is proven twice before it gets here.

No inventory table carries a beneficiary foreign key. Anonymous distributions
are a `distribution` movement header with aggregate lines, and that is the
schema's enforcement of it: there is nowhere to put a person.

---

## Beyond Phase 4

Not scheduled. Recorded so the schema does not accidentally foreclose any of it.

| Direction                              | What it means for the schema                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Assistance / beneficiary records**   | `DATABASE-SCHEMA.md` is explicit and this plan keeps it: a **separate database or service** with different credentials, authorization, retention, logging and governance. Not a schema in this database. The absence of a person foreign key anywhere in `inventory` and `operations` is what keeps that door closed by construction.                                                                      |
| **Second and third city**              | Already a data change, not a schema change — `core.cities` activation surfaces filters and the simulator question. The pressure lands on indexes: `city_id` becomes the leading column on public queries, and the Stage 0.9 sweep should anticipate it. Per-city partitioning is available later without a model change.                                                                                   |
| **Second country**                     | Where the model gets genuinely tested: legal documents and retention are per-jurisdiction, `core.legal_documents` is versioned by kind and language but not by territory, and phone formats stop being French. A `jurisdiction` dimension on legal documents and organisation verification is the additive answer.                                                                                         |
| **Analytics and measurement**          | Never against the primary. Read replica plus a warehouse fed by CDC. §10's rule holds forever: no simulator answer values and no reconstructable result path, in the warehouse either.                                                                                                                                                                                                                     |
| **Search at scale**                    | `public_api.search_suggestions` with `pg_trgm` and `tsvector` is the plan and is sufficient for a long time. If it stops being sufficient, an external index (Meili, Typesense) consumes the same materialized read model — which is why search stays a derived projection and never becomes a column on `activities`.                                                                                     |
| **Erasure and retention as machinery** | Today retention is prose. It becomes a table of policies plus a worker, with `audit.retention_actions` as the evidence — the shape `documents.retention_actions` establishes in Stage 3, generalized. The append-only tables are the hard part: erasure has to be anonymisation in place, which is why `audit.events` carries `actor_label` (§17) rather than depending on the account row still existing. |
| **Time-series growth**                 | `audit.events` partitioned from Stage 0.12; `notifications.delivery_attempts` and `inventory.movement_lines` are the next two, both by month, both easier before the first million rows.                                                                                                                                                                                                                   |
| **Outbox to a real queue**             | `notifications.outbox` is the transactional handoff and stays regardless. What changes later is the consumer, not the table — which is the point of the pattern.                                                                                                                                                                                                                                           |
| **Enum pressure**                      | 67 enums is a lot of state machines — Stage 2 added ten. §2's rule is the guard: stable lifecycles are enums, evolving vocabularies are rows. Anything that has needed two enum-value additions in a quarter was a row all along.                                                                                                                                                                          |
| **Column-level encryption**            | Forced in Stage 2, inherited by Stage 3. Beyond that it is key management — an external KMS, keys not in the database that holds the ciphertext, and rotation that does not require rewriting append-only tables.                                                                                                                                                                                          |

### What "future-proof" is not

`DATABASE-SCHEMA.md` §2 says it and it is worth keeping at the end of this plan:
future-proof does not mean schema-free. A new business concept gets an additive
table and a migration. It does not get squeezed into a generic
entity/attribute/value table, and it does not get a `jsonb` column standing in
for a relation somebody will need to query.

## Invariants every stage re-checks

Not a one-time checklist — the tests that make the above true and keep it true.

1. A query without tenant context returns zero rows.
2. `infokit_reader` can reach no unpublished row, no archived row, and no
   `steward_*` column, on any surface.
3. `infokit_app` cannot `UPDATE` or `DELETE` any append-only table.
4. Every foreign key either has a leading index or a comment saying why not.
5. §20 is verified by a test that reads `pg_constraint`, not by rereading §20.
6. `db:drift` is clean and `check:ci` is green.
7. No migration file that has been applied anywhere is ever edited.
