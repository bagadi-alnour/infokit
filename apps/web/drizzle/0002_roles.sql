-- Hand-written (`db:generate --custom`): drizzle-orm has `pgRole` but no grant
-- primitive, so privileges cannot come from the schema at all.
-- docs/SCHEMA-DELIVERY-PLAN.md §0.4.

-- Why a second identity exists ---------------------------------------------
--
-- A table's owner bypasses row-level security regardless of superuser status,
-- unless the table is marked FORCE ROW LEVEL SECURITY. The app connects as the
-- owner today, so every policy 0.5 writes would be decorative — and it would be
-- decorative *only in the environment where the policies were written*, which is
-- the worst version of that bug. `infokit_app` owns nothing and can bypass
-- nothing, so a policy that does nothing locally does nothing in production too,
-- where somebody notices.
--
-- This file is byte-identical in both environments and has no conditional
-- branches, which is what makes a `pg_dump --schema-only --no-owner` diff between
-- local and production meaningful for privileges and not just for schema.
--
-- Scope is deliberately one role, not §0.4's four. `infokit_reader` has nothing
-- to read until 0.6 creates the `public_api` views, `infokit_worker` has no jobs
-- to run, and `infokit_owner` only starts to mean something with 0.5. Three roles
-- holding no grants would be declarations shaped like controls; each lands in the
-- migration that gives it something to do.

-- Guarded because `CREATE ROLE` is cluster-scoped while the migration journal
-- `drizzle.__drizzle_migrations` lives inside each database. Apply this chain to a
-- second database in the same cluster — which the verification in
-- docs/SCHEMA-DELIVERY-PLAN.md and `db:migrate:verify` both do — and an unguarded
-- CREATE ROLE fails and leaves that chain half applied.
--
-- No PASSWORD here, deliberately: a credential in a migration file is a
-- credential in git history, and the two environments need different ones. It is
-- set out of band, once per environment:
--
--   psql "$DATABASE_URL_MIGRATOR" -c "ALTER ROLE infokit_app PASSWORD '…'"
--
-- Forgetting it fails loudly and immediately — the app cannot authenticate at
-- all — which is why a documented step is proportionate here.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'infokit_app') THEN
    CREATE ROLE infokit_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;--> statement-breakpoint

-- Headroom for the operator, not a throttle on the app. `max_connections` is 100
-- locally and ~112 on db.t4g.micro at 1 GiB; either way this leaves the master
-- role enough to run a migration, open studio and attach psql while the app is at
-- its ceiling. A runaway scale-out then degrades the app instead of locking the
-- operator out of the database it needs to fix it.
ALTER ROLE infokit_app CONNECTION LIMIT 90;--> statement-breakpoint

-- The database name differs per environment, so it is read rather than written.
-- PUBLIC holds CONNECT on every database by default, so without the revoke,
-- granting it to one role restricts nothing.
DO $$ BEGIN
  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT  CONNECT ON DATABASE %I TO infokit_app', current_database());
END $$;--> statement-breakpoint

GRANT USAGE ON SCHEMA auth, core, content, operations, simulator,
  notifications, audit TO infokit_app;--> statement-breakpoint

-- `public_api` is deliberately absent: the views are 0.6's, and `infokit_reader`
-- is the identity that will read them.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth, core, content,
  operations, simulator, notifications, audit TO infokit_app;--> statement-breakpoint

-- Without this, every future migration that adds a table needs its own GRANT or
-- the app cannot see it — and the failure arrives as a permission error on one
-- page, long after the migration looked fine.
--
-- `FOR ROLE postgres` names the role that creates the objects, and default
-- privileges only apply to what that named role creates afterwards. That is why
-- the RDS master user must also be `postgres`: name it anything else and these
-- lines silently do nothing there, so the app loses access to every table added
-- after this migration. It is the quietest way to get this file wrong.
--
-- No `ON SEQUENCES` counterpart: the schema has zero sequences (`pg_class`
-- relkind 'S' in these seven schemas is 0), because it has no serial, bigserial
-- or identity column — `core.tags.scope_key` and `content.services.scope_key` are
-- GENERATED ALWAYS AS … STORED, which needs no sequence. Add the sequence line in
-- the same migration as the first identity column.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth, core, content,
  operations, simulator, notifications, audit
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO infokit_app;--> statement-breakpoint

-- The eight append-only tables (§0.4): evidence, not state. A verification that
-- can be edited is not evidence of anything, and a delivery ledger the app can
-- rewrite cannot answer "did the invitation arrive?".
--
-- This is the cheap first line and it stops exactly one actor, the app. 0.7's
-- triggers stop everyone, including a migration and including whoever is holding
-- psql, and that is the durable guarantee. Note also that the ALTER DEFAULT
-- PRIVILEGES above re-grants UPDATE and DELETE, so a later migration that
-- recreates one of these tables brings it back writable — another reason 0.7 is
-- the real answer and this is the ordering §0.4 asks for.
--
-- `audit.events` is partitioned. Privileges are checked on the relation the query
-- names, and the app only ever names the parent, so revoking there is enough. New
-- partitions do not inherit this revoke — irrelevant while nothing addresses a
-- partition directly, worth remembering if anything ever does.
REVOKE UPDATE, DELETE ON
  audit.events,
  content.activity_verifications,
  content.activity_occurrence_confirmations,
  content.activity_custody_events,
  content.editorial_revisions,
  content.translation_source_versions,
  content.translation_assignment_events,
  notifications.delivery_attempts
FROM infokit_app;
