CREATE TYPE "content"."basic_information_operator" AS ENUM('state', 'association');--> statement-breakpoint
ALTER TABLE "content"."basic_information_details" ADD COLUMN "operator" "content"."basic_information_operator" DEFAULT 'state' NOT NULL;--> statement-breakpoint
-- Backfill. The column defaults to `state`, which is right for the emergency
-- numbers and wrong for every association line already on file, so the rows that
-- were association-run before this column existed are named here.
--
-- Two conditions, because neither alone reaches all of them:
--
--   * `answered_by_organization_id is not null` — the line belongs to an
--     association that has a record here (Utopia 56, Human Rights Observers).
--   * `dial_instead is not null` — the tile presses a number other than its own,
--     which today is only ever the sea-rescue card: it prints Alarm Phone's
--     number and dials 112. Alarm Phone is a transnational network with no row
--     in `core.organizations`, so the first condition cannot see it.
--
-- This is a one-time reading of existing rows, not a rule. From here the column
-- is authoritative and is set explicitly on every write.
UPDATE "content"."basic_information_details"
SET "operator" = 'association'
WHERE "answered_by_organization_id" IS NOT NULL
   OR "dial_instead" IS NOT NULL;
