import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizationMembers } from "./access";
import { users } from "./auth";
import { languages } from "./catalog";
import { trainingCourses } from "./courses";
import { organizations } from "./organizations";
import {
  courseVisibility,
  operations,
  requirementNecessity,
  skillKind,
  timestamps,
  trainingRecordState,
} from "./schemas";
import { translators } from "./translators";

/**
 * The skills half of docs/DATABASE-SCHEMA.md §12 — what a mission needs from
 * the people carrying it, beside the courses they have done.
 *
 * One table, scoped by a nullable `organizationId`. Null is the platform's own
 * vocabulary and is where most of it lives: a driving permit category, first
 * aid, the software several associations share all mean the same thing
 * everywhere, so InfoKit authors them once and nobody retypes them. An
 * organisation adds a row when the thing is genuinely its own, and creating it
 * is what scopes it — `visibility` then says how far beyond itself it reaches,
 * exactly as it does for a course. A row with no organisation has nowhere to be
 * kept, so it is always network wide; the check below is that sentence.
 *
 * Names are stored as three columns rather than translation rows. These strings
 * are read inside organisation workspaces, never by the public, so the three
 * interface languages are the whole requirement — and fr is the one that must
 * be there, because it is the language the network works in.
 *
 * Nothing here is a free-text label: a person declares a skill by selecting a
 * row (`operations.skill_records`), which is what lets a requirement be matched
 * by id instead of by spelling.
 */
export const skills = operations.table(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null = the platform's own, global row. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    kind: skillKind("kind").notNull().default("skill"),
    code: varchar("code", { length: 100 }).notNull(),
    nameFr: varchar("name_fr", { length: 160 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }),
    nameAr: varchar("name_ar", { length: 160 }),
    descriptionFr: text("description_fr"),
    visibility: courseVisibility("visibility")
      .notNull()
      .default("organization"),
    /**
     * Whether a declaration needs someone to confirm it. False means the
     * person's own word stands (`self_declared`); true sends the record to
     * `awaiting_verification` instead.
     */
    verificationRequired: boolean("verification_required")
      .notNull()
      .default(false),
    /** How long a declaration stays good for; null means it does not expire. */
    validityMonths: integer("validity_months"),
    /** Where to read about it — a link, never an attachment. */
    referenceUrl: text("reference_url"),
    active: boolean("active").notNull().default(true),
    createdById: uuid("created_by_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    /**
     * Unique per scope: `coalesce` rather than a plain unique constraint,
     * because Postgres treats two NULL organisations as distinct and would let
     * the platform hold the same code twice (the trick `core.tags` uses).
     */
    uniqueIndex("skills_scope_kind_code_uq").on(
      sql`coalesce(${t.organizationId}::text, '')`,
      t.kind,
      t.code,
    ),
    /** Two rows named the same thing in one scope are one row typed twice. */
    uniqueIndex("skills_scope_name_fr_uq").on(
      sql`coalesce(${t.organizationId}::text, '')`,
      sql`lower(regexp_replace(btrim(${t.nameFr}), '[[:space:]]+', ' ', 'g'))`,
    ),
    check(
      "skills_global_reach_check",
      sql`${t.organizationId} is not null or ${t.visibility} = 'all_organizations_and_translators'`,
    ),
    check(
      "skills_validity_months_check",
      sql`${t.validityMonths} is null or ${t.validityMonths} between 1 and 600`,
    ),
    index("skills_org_active_idx").on(t.organizationId, t.active),
    /** "Which skills may I offer?" is read as visibility plus active. */
    index("skills_visibility_active_idx").on(t.visibility, t.active),
    index("skills_kind_active_idx").on(t.kind, t.active),
  ],
);

/**
 * One person's declaration on one skill — the same shape as
 * `operations.training_records`, deliberately, so the two read alike: the
 * person is an organisation member **or** an external translator, never both
 * and never neither, and the state, the dates and the verifier columns are the
 * course table's.
 *
 * There is no label column. A record points at a catalogue row, so there is
 * nothing to type and nothing to spell differently — that is the whole reason
 * the catalogue is shared. Which rows a person may point at is a comparison
 * across two rows (the skill's scope and visibility against who they are), so
 * the service layer enforces it on write; the database keeps the shape honest.
 *
 * docs/PHASE-3-TEAM-MANAGEMENT.md: no licence number and no scan, for any kind
 * of skill. A coordinator needs to know somebody may drive, not to hold a copy
 * of their licence.
 */
export const skillRecords = operations.table(
  "skill_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => organizationMembers.id, {
      onDelete: "cascade",
    }),
    translatorId: uuid("translator_id").references(() => translators.id, {
      onDelete: "cascade",
    }),
    state: trainingRecordState("state").notNull().default("self_declared"),
    obtainedOn: date("obtained_on"),
    /** Derived from the skill's validity period when it has one. */
    expiresOn: date("expires_on"),
    verifiedById: uuid("verified_by_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** The person's own context, and a reviewer's reason for refusing. */
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    check(
      "skill_records_holder_check",
      sql`(${t.memberId} is not null) <> (${t.translatorId} is not null)`,
    ),
    check(
      "skill_records_validity_check",
      sql`${t.expiresOn} is null or ${t.obtainedOn} is null or ${t.expiresOn} >= ${t.obtainedOn}`,
    ),
    /** A decision has both a decider and a time, or is not a decision. */
    check(
      "skill_records_verifier_check",
      sql`(${t.verifiedAt} is null) = (${t.verifiedById} is null)`,
    ),
    /** One entry per skill per person; renewing updates the dates. */
    uniqueIndex("skill_records_skill_member_uq")
      .on(t.skillId, t.memberId)
      .where(sql`${t.memberId} is not null`),
    uniqueIndex("skill_records_skill_translator_uq")
      .on(t.skillId, t.translatorId)
      .where(sql`${t.translatorId} is not null`),
    index("skill_records_member_idx").on(t.memberId),
    index("skill_records_translator_idx").on(t.translatorId),
    /** The verification queue: this skill, waiting on a decision. */
    index("skill_records_skill_state_idx").on(t.skillId, t.state),
    /** Validity sweeps read "verified and past its date". */
    index("skill_records_expires_idx").on(t.expiresOn),
  ],
);

/**
 * What an organisation asks of the people on one kind of mission — written
 * down before the mission entity exists, because the requirement is what the
 * association already knows: a maraude needs someone who may drive, a
 * permanence needs the OCP course and the tool the team works in.
 *
 * A set belongs to one organisation: it is that organisation's rule, even when
 * every row it points at is global. Nothing references a set yet — the Phase 3
 * planning work (docs/DATABASE-SCHEMA.md §13) is what will point a mission at
 * one. Until then a set is read by hand, against a person or a group, through
 * the matcher in `~/lib/requirement-matching`.
 *
 * The name is a plain column with its source language, like a course title:
 * this is internal workspace text, not published content.
 */
export const requirementSets = operations.table(
  "requirement_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 100 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    sourceLanguageCode: varchar("source_language_code", { length: 35 })
      .notNull()
      .default("fr")
      .references(() => languages.code),
    active: boolean("active").notNull().default(true),
    createdById: uuid("created_by_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("requirement_sets_org_code_uq").on(t.organizationId, t.code),
    index("requirement_sets_org_active_idx").on(t.organizationId, t.active),
  ],
);

/**
 * One condition in a set: a skill, a course, or a spoken language — exactly
 * one of the three. Three real foreign keys with an exclusive check, rather
 * than a kind column and an untyped id, so the database can say what a
 * requirement points at and a delete cannot leave one dangling.
 *
 * A language is a code from `core.languages`, matched against
 * `core.member_languages` / `core.translator_languages`. `languages.enabled`
 * plays no part here: whether the site publishes content in Italian is a
 * different question from whether somebody speaks it.
 *
 * `mustBeVerified` and `mustBeCurrent` are the two ways a declaration can be
 * present but not good enough — somebody's own word where proof was wanted,
 * and a validity period that has run out. `minimumCount` is how many people in
 * the group need it ("two drivers"); null means everyone assigned.
 */
export const requirementItems = operations.table(
  "requirement_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => requirementSets.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id").references(() => skills.id, {
      onDelete: "cascade",
    }),
    courseId: uuid("course_id").references(() => trainingCourses.id, {
      onDelete: "cascade",
    }),
    languageCode: varchar("language_code", { length: 35 }).references(
      () => languages.code,
    ),
    necessity: requirementNecessity("necessity").notNull().default("required"),
    mustBeVerified: boolean("must_be_verified").notNull().default(false),
    /** A declaration past its validity period does not count. */
    mustBeCurrent: boolean("must_be_current").notNull().default(true),
    minimumCount: integer("minimum_count"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    check(
      "requirement_items_target_check",
      sql`(${t.skillId} is not null)::int + (${t.courseId} is not null)::int + (${t.languageCode} is not null)::int = 1`,
    ),
    check(
      "requirement_items_minimum_count_check",
      sql`${t.minimumCount} is null or ${t.minimumCount} between 1 and 100`,
    ),
    /** One condition per target per set; changing it is an update. */
    uniqueIndex("requirement_items_set_skill_uq")
      .on(t.setId, t.skillId)
      .where(sql`${t.skillId} is not null`),
    uniqueIndex("requirement_items_set_course_uq")
      .on(t.setId, t.courseId)
      .where(sql`${t.courseId} is not null`),
    uniqueIndex("requirement_items_set_language_uq")
      .on(t.setId, t.languageCode)
      .where(sql`${t.languageCode} is not null`),
    index("requirement_items_set_idx").on(t.setId),
  ],
);
