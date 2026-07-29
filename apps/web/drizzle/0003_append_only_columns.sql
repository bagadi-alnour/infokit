-- Two of the eight append-only tables from 0002 are append-only in their *content*
-- and mutable in their *annotations*, and a table-level REVOKE UPDATE cannot say
-- so. Column-level grants can, so they say it here rather than 0002 dropping the
-- two tables from its list wholesale.
--
-- This is a separate migration and not an edit to 0002 because 0002 has been
-- applied: the journal stores a hash of the file's contents, so editing an applied
-- file makes the record of what ran disagree with what is on disk. Applied
-- forward-only the pair reads as one decision — see docs/SCHEMA-DELIVERY-PLAN.md
-- §0.4 for the list and the reasoning.
--
-- Found by grepping the app for writes to the eight before exercising the
-- dashboard, which is cheaper than meeting it as a `permission denied` inside a
-- server action. The other six take no UPDATE or DELETE anywhere in `src/`.

-- Freshness metadata, not sealed content. `content.editorial_revisions` carries
-- the revision's identity (`revision_number`) and the authored text lives in
-- `content.editorial_revision_translations`; both stay immutable. These three
-- columns are the dated public-warning state (FR-P1-009/010), which by design
-- changes on a revision that already exists — publishing a new revision just to
-- mark an old one unreliable would inflate the revision number for something
-- nobody authored. Written by `updateArticleFreshness` in
-- src/app/[locale]/dashboard/articles/actions.ts, gated on `content.article.write`.
GRANT UPDATE ("can_become_outdated", "unreliable_from", "source_summary")
  ON TABLE content.editorial_revisions TO infokit_app;

-- The translation source snapshot, while the revision it points at is still being
-- edited. `articles/actions.ts` rewrites it in place on a save that is explicitly
-- not a new revision (`!input.isNewRevision`); a save that *is* one appends a row
-- with the next `version` instead. So the append-only guarantee here is per
-- revision, which no privilege can express — 0.7's triggers are where that becomes
-- enforceable, keyed on whether the source revision has been sealed. `version`,
-- `entity_id`, `source_revision_id` and `previous_version_id` stay immutable,
-- which is what keeps the version chain worth trusting.
GRANT UPDATE ("source_content_json", "source_content_hash")
  ON TABLE content.translation_source_versions TO infokit_app;

-- DELETE stays revoked on both, and on all eight: nothing in the app deletes from
-- any of them.
--
-- One consequence to carry: ALTER DEFAULT PRIVILEGES cannot express a column-level
-- grant, so unlike 0002's table grants these two statements do not apply
-- themselves to a future table. A migration that ever drops and recreates either
-- table has to repeat them, and 0.7's triggers are the durable answer for both
-- tables regardless.
