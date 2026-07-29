-- Hand-written (`db:generate --custom`), because none of this is expressible in
-- the drizzle schema: extensions, a schema drizzle does not own, and declarative
-- partitioning. docs/SCHEMA-DELIVERY-PLAN.md §0.2.

-- Extensions ---------------------------------------------------------------
--
-- All three are on RDS's allowlist, so this file needs no cloud variant.
-- `pgcrypto` for digest/HMAC in the database where a query needs one — note
-- `gen_random_uuid()` is core since PG13 and does *not* depend on it, so do not
-- read the default on every `id` column as a reason this extension exists.
-- `unaccent` and `pg_trgm` are the search pair: fold the diacritics, then match
-- on trigrams, so a visitor typing "creche" finds "crèche". No PostGIS —
-- coordinates are two numeric columns until something needs real geometry.
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- The public read surface ---------------------------------------------------
--
-- Empty for now: §0.6's eight views land here, and `infokit_reader` is created
-- in the migration that first has something for it to read. The schema exists
-- ahead of them so that "what may a visitor see?" has one answer with a name,
-- rather than being whichever tables a query happened to reach.
CREATE SCHEMA IF NOT EXISTS "public_api";--> statement-breakpoint

-- Partitions for audit.events ----------------------------------------------
--
-- `audit.events` is declared `PARTITION BY RANGE ("occurred_at")` in 0000. A
-- partitioned table with no partition covering a row *rejects the insert*, and
-- an audit write that throws takes the audited action down with it — so the
-- DEFAULT partition below is not tidiness, it is what keeps a missed month from
-- becoming an outage.
--
-- One partition per month, bounded at 2027-12 deliberately: an open-ended loop
-- would hide the fact that somebody has to extend this. Extending it is this
-- same block with two new dates, in a new migration.
--
-- Two operational facts that are easy to learn the hard way:
--
--   1. Rows landing in `events_default` are a signal, not a fallback that did
--      its job. Alarm on its row count — the correct value is always 0. Moving
--      them into a real partition afterwards needs a lock and a copy, so the
--      cheap fix is to notice before it happens.
--   2. Dropping an expired month is a THREE-step operation, because
--      `notifications.delivery_attempts` holds a foreign key into this table:
--      null the referencing pointers for that month, then
--      `ALTER TABLE audit.events DETACH PARTITION …`, then `DROP TABLE …`.
--      Verified against PG 18: a plain `DROP TABLE` on an attached partition
--      fails with "other objects depend on it", and `DETACH` fails while any
--      ledger row still points into the month. Never reach for `DROP … CASCADE`
--      to get past it — it succeeds, and what it drops is the foreign key
--      itself, leaving the ledger permanently able to name events that do not
--      exist. The clean way out is a retention window for the ledger no longer
--      than this table's, so the pointers are already gone; §17 owns that
--      decision and has not made it yet.
DO $$
DECLARE
  month_start date := date '2026-07-01';
  bound        date := date '2028-01-01';
  month_end    date;
BEGIN
  WHILE month_start < bound LOOP
    month_end := month_start + interval '1 month';
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS audit.%I PARTITION OF audit.events'
      || ' FOR VALUES FROM (%L) TO (%L)',
      'events_' || to_char(month_start, 'YYYY_MM'),
      month_start,
      month_end
    );
    month_start := month_end;
  END LOOP;
END $$;--> statement-breakpoint

-- Anything outside the months above, so an insert never fails on a range.
CREATE TABLE IF NOT EXISTS audit.events_default PARTITION OF audit.events DEFAULT;
