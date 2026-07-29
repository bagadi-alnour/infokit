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
import { organizations } from "./organizations";
import {
  courseVisibility,
  operations,
  timestamps,
  trainingRecordState,
} from "./schemas";
import { translators } from "./translators";

/**
 * The training/course catalogue of docs/DATABASE-SCHEMA.md §12, pulled forward
 * from Phase 3 for the one part the network needs early: an organisation that
 * trains people — its own volunteers, a partner's, the translators it works
 * with — needs somewhere to say what that training is, so a person can claim it
 * and a coordinator can read it.
 *
 * A course belongs to an organisation, or to nobody — `organizationId` is null
 * for the platform's own rows, which is where the reusable ones live: first aid
 * and the trainings several associations send people to mean the same thing
 * everywhere, so InfoKit authors them once. `visibility` is how far an
 * organisation's own course reaches beyond it; a platform course has nowhere to
 * be kept, so it is always network wide (the check below).
 * `createdById` stays a separate column, so who typed the row never gets
 * confused with who owns it. Courses are retired with `active`, not deleted:
 * `training_records` are people's qualifications, and a delete would take them
 * with it.
 *
 * `visibility` is the whole reach story for the row, exactly as it is for a
 * coordination event: the owner's members always see it, `all_organizations`
 * opens it to every verified organisation's members, and
 * `all_organizations_and_translators` also to the external translators of
 * `core.translators`. Nothing here is public — no public read model selects
 * from this schema.
 */
export const trainingCourses = operations.table(
  "training_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null = the platform's own, global course. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    slug: varchar("slug", { length: 100 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    /**
     * A platform course is read in every workspace, so it may carry the other
     * two interface languages. Null falls back to `title`.
     */
    titleEn: varchar("title_en", { length: 200 }),
    titleAr: varchar("title_ar", { length: 200 }),
    description: text("description"),
    visibility: courseVisibility("visibility")
      .notNull()
      .default("organization"),
    /** The body that delivers it, when it is not the owner itself. */
    provider: varchar("provider", { length: 200 }),
    /** Where to follow or book the course; a link, not an attachment. */
    url: text("url"),
    /**
     * The language the title and description are written in. A course is not
     * published content — nobody outside the network reads it — so it is stored
     * once, in the language its owner runs it in, with no translation rows.
     */
    sourceLanguageCode: varchar("source_language_code", { length: 35 })
      .notNull()
      .default("fr")
      .references(() => languages.code),
    /**
     * Whether a claim needs someone to confirm it. False means the person's own
     * word stands (`self_declared`); true sends the record to
     * `awaiting_verification` instead.
     */
    verificationRequired: boolean("verification_required")
      .notNull()
      .default(false),
    /** How long a completion stays good for; null means it does not expire. */
    validityMonths: integer("validity_months"),
    active: boolean("active").notNull().default(true),
    createdById: uuid("created_by_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    /**
     * Unique per scope, through `coalesce`: Postgres treats two NULL
     * organisations as distinct, so a plain unique constraint would let the
     * platform hold the same slug twice.
     */
    uniqueIndex("training_courses_scope_slug_uq").on(
      sql`coalesce(${t.organizationId}::text, '')`,
      t.slug,
    ),
    check(
      "training_courses_global_reach_check",
      sql`${t.organizationId} is not null or ${t.visibility} = 'all_organizations_and_translators'`,
    ),
    check(
      "training_courses_validity_months_check",
      sql`${t.validityMonths} is null or ${t.validityMonths} between 1 and 600`,
    ),
    index("training_courses_org_active_idx").on(t.organizationId, t.active),
    /** "Which courses may I add?" is read as visibility plus active. */
    index("training_courses_visibility_active_idx").on(t.visibility, t.active),
  ],
);

/**
 * One person's claim on one course — what "adding a course to my skills"
 * writes. Its twin is `operations.skill_records`: both point at a catalogue
 * entry rather than at typed text, and carry a state, a date and, when the row
 * demands it, a verifier.
 *
 * The learner is an organisation member **or** an external translator, never
 * both and never neither: two real foreign keys with an exclusive-arc check,
 * rather than the entity-kind pair the publication tables use as a documented
 * exception. Both kinds of people take the same courses, and the visibility of
 * the course decides which of them may claim it — a translator may only reach
 * an `all_organizations_and_translators` course, a member of another
 * organisation an `all_organizations` one. That comparison spans two rows, so
 * the service layer enforces it on write; the database keeps the shape honest.
 */
export const trainingRecords = operations.table(
  "training_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => trainingCourses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => organizationMembers.id, {
      onDelete: "cascade",
    }),
    translatorId: uuid("translator_id").references(() => translators.id, {
      onDelete: "cascade",
    }),
    state: trainingRecordState("state").notNull().default("self_declared"),
    completedOn: date("completed_on"),
    /** Derived from the course's validity period when it has one. */
    expiresOn: date("expires_on"),
    verifiedById: uuid("verified_by_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** The person's own context, and a reviewer's reason for refusing. */
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    check(
      "training_records_learner_check",
      sql`(${t.memberId} is not null) <> (${t.translatorId} is not null)`,
    ),
    check(
      "training_records_validity_check",
      sql`${t.expiresOn} is null or ${t.completedOn} is null or ${t.expiresOn} >= ${t.completedOn}`,
    ),
    /** A decision has both a decider and a time, or is not a decision. */
    check(
      "training_records_verifier_check",
      sql`(${t.verifiedAt} is null) = (${t.verifiedById} is null)`,
    ),
    /** One entry per course per person; retaking updates the dates. */
    uniqueIndex("training_records_course_member_uq")
      .on(t.courseId, t.memberId)
      .where(sql`${t.memberId} is not null`),
    uniqueIndex("training_records_course_translator_uq")
      .on(t.courseId, t.translatorId)
      .where(sql`${t.translatorId} is not null`),
    index("training_records_member_idx").on(t.memberId),
    index("training_records_translator_idx").on(t.translatorId),
    /** The verification queue: this course, waiting on a decision. */
    index("training_records_course_state_idx").on(t.courseId, t.state),
    /** Validity sweeps read "verified and past its date". */
    index("training_records_expires_idx").on(t.expiresOn),
  ],
);
