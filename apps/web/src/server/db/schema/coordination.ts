import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizationMembers } from "./access";
import { assets } from "./assets";
import { users } from "./auth";
import { cities, languages } from "./catalog";
import { organizations } from "./organizations";
import { places } from "./places";
import {
  archival,
  coordinationEventStatus,
  coordinationEventVisibility,
  coordinationParticipationState,
  operations,
  stewardContact,
  timestamps,
  transitMode,
} from "./schemas";

/**
 * The shared coordination agenda (docs/DATABASE-SCHEMA.md §13, FR-P2-023):
 * one meeting or event hosted by an organisation — or by the platform when
 * `hostOrganizationId` is null — carrying a city and one explicit visibility
 * tier. `visibility` is the whole access story for the record: `organization`
 * stays inside the host, `inter_organization` reaches authenticated members of
 * verified organisations, and `public` is the host's deliberate decision to
 * show the event to visitors. Reads go through
 * `~/server/content/coordination-events`, never straight at this table.
 */
export const coordinationEvents = operations.table(
  "coordination_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostOrganizationId: uuid("host_organization_id").references(
      () => organizations.id,
    ),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id),
    visibility: coordinationEventVisibility("visibility")
      .notNull()
      .default("organization"),
    status: coordinationEventStatus("status").notNull().default("scheduled"),
    /** A known place record, when the event happens at one we publish. */
    placeId: uuid("place_id").references(() => places.id),
    /** Free-text meeting point for everything a place record does not cover. */
    locationLabel: varchar("location_label", { length: 200 }),
    /** One safe contact for the event — never a member's personal number. */
    contactLabel: varchar("contact_label", { length: 120 }),
    contactValue: varchar("contact_value", { length: 200 }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** A day-long event shows a date, not a time range. */
    allDay: boolean("all_day").notNull().default(false),
    sourceLanguageCode: varchar("source_language_code", { length: 35 })
      .notNull()
      .default("fr")
      .references(() => languages.code),
    createdById: uuid("created_by_id").references(() => users.id),
    ...stewardContact,
    ...archival,
    ...timestamps,
  },
  (t) => [
    check("coordination_events_range_check", sql`${t.endsAt} >= ${t.startsAt}`),
    // The agenda is always read as "this city, this window".
    index("coordination_events_city_starts_idx").on(t.cityId, t.startsAt),
    index("coordination_events_host_starts_idx").on(
      t.hostOrganizationId,
      t.startsAt,
    ),
    // The public surface asks only for the public tier.
    index("coordination_events_visibility_starts_idx").on(
      t.visibility,
      t.startsAt,
    ),
  ],
);

/**
 * The repeat rule behind a recurring meeting (FR-P2-024). One row per event, so
 * "every second Tuesday" is stated once and the dates below are derived from it.
 *
 * The rule is stored as local time plus a timezone plus a duration, never as a
 * pair of absolute instants: a coordination meeting is "Tuesdays at 14:00 in
 * Calais", and that is a different instant in winter than in summer. Storing
 * `timestamptz` bounds instead would silently move the meeting by an hour on the
 * last Sunday of March. The absolute instants belong to the occurrences, which
 * are materialised from this row.
 */
export const coordinationEventSeries = operations.table(
  "coordination_event_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => coordinationEvents.id, { onDelete: "cascade" }),
    /** IANA zone the local time is read in — `Europe/Paris` for Calais. */
    timezone: varchar("timezone", { length: 50 })
      .notNull()
      .default("Europe/Paris"),
    /** RFC 5545 RRULE. Null while a series exists but its rule is unwritten. */
    rrule: text("rrule"),
    localStartTime: time("local_start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    /** The first date the rule applies from, and the last it applies to. */
    startsOn: timestamp("starts_on", { withTimezone: true }).notNull(),
    endsOn: timestamp("ends_on", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // One rule per event: two rules would make "when does this meet?"
    // unanswerable without deciding which one wins.
    unique("coordination_event_series_event_uq").on(t.eventId),
    check(
      "coordination_event_series_duration_check",
      sql`${t.durationMinutes} > 0 and ${t.durationMinutes} <= 1440`,
    ),
    check(
      "coordination_event_series_window_check",
      sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`,
    ),
  ],
);

/**
 * One dated instance of an event (FR-P2-024). Every event the agenda shows is
 * read from here, whether it repeats or not, so the calendar has one shape to
 * query instead of a union of single events and expanded rules.
 *
 * Cancelling one Tuesday cancels the row, not the series — `state` is
 * per-occurrence for that reason, and it reuses `coordination_event_status`
 * rather than `occurrence_state`: a public activity can be `uncertain` because
 * a volunteer may not turn up, but a meeting is either held or called off.
 *
 * The host is *not* copied onto this row. Denormalising it would let the tenant
 * policy compare a column instead of joining, but the guard that would keep the
 * copy honest cannot hold: a composite foreign key with a null column is not
 * checked at all, and a platform-hosted event's occurrences have exactly that
 * null. So visibility is resolved through `event_id` against the event, which is
 * a primary-key lookup, and there is one place the host is recorded.
 */
export const coordinationEventOccurrences = operations.table(
  "coordination_event_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    /** Null for a one-off, and for a date lifted out of its rule by hand. */
    seriesId: uuid("series_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    state: coordinationEventStatus("state").notNull().default("scheduled"),
    ...timestamps,
  },
  (t) => [
    // Named explicitly, like every foreign key below: the generated name for a
    // table this long exceeds Postgres's 63-character identifier limit, and a
    // silently truncated name never matches what the schema says, so `db:push`
    // drops and recreates the constraint on every run.
    foreignKey({
      name: "coordination_event_occurrences_event_fk",
      columns: [t.eventId],
      foreignColumns: [coordinationEvents.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "coordination_event_occurrences_series_fk",
      columns: [t.seriesId],
      foreignColumns: [coordinationEventSeries.id],
    }).onDelete("set null"),
    check(
      "coordination_event_occurrences_range_check",
      sql`${t.endsAt} >= ${t.startsAt}`,
    ),
    // Re-materialising a rule must not double a date it already produced.
    uniqueIndex("coordination_event_occurrences_event_start_uq").on(
      t.eventId,
      t.startsAt,
    ),
    // The agenda is read as a window across every event a member may see.
    index("coordination_event_occurrences_starts_idx").on(t.startsAt),
    index("coordination_event_occurrences_state_starts_idx").on(
      t.state,
      t.startsAt,
    ),
  ],
);

/**
 * Why one date was cancelled, in each language it has been written in.
 *
 * A cancellation is the one thing about an occurrence that is prose, and it is
 * read by exactly the people least able to read French — so it is translated
 * like every other reader-facing string rather than stored once on the
 * occurrence. Mirrors `content.public_event_occurrence_translations`.
 */
export const coordinationEventOccurrenceTranslations = operations.table(
  "coordination_event_occurrence_translations",
  {
    occurrenceId: uuid("occurrence_id").notNull(),
    languageCode: varchar("language_code", { length: 35 }).notNull(),
    cancellationReason: text("cancellation_reason").notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({
      name: "coordination_event_occurrence_translations_pk",
      columns: [t.occurrenceId, t.languageCode],
    }),
    foreignKey({
      name: "coordination_event_occurrence_translations_occ_fk",
      columns: [t.occurrenceId],
      foreignColumns: [coordinationEventOccurrences.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "coordination_event_occurrence_translations_lang_fk",
      columns: [t.languageCode],
      foreignColumns: [languages.code],
    }),
  ],
);

/**
 * What one organisation answered about one coordination event (FR-P2-025).
 *
 * The answer is per organisation, not per person: the agenda's question is "is
 * your association coming?", and a coordinator planning a distribution needs one
 * answer per association rather than a headcount of who clicked. `memberId`
 * records who answered on its behalf and is held to the same organisation by a
 * composite key, so nobody answers for a workspace they do not belong to.
 *
 * `occurrenceId` is null for "we attend this series" and set for "we attend the
 * 12th". `eventId` is always present either way, so the visibility policy — who
 * may even see that this event exists — reads one column instead of resolving a
 * nullable occurrence first.
 *
 * There is no `pending` state: not having answered is the absence of a row.
 */
export const coordinationEventParticipation = operations.table(
  "coordination_event_participation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    occurrenceId: uuid("occurrence_id"),
    organizationId: uuid("organization_id").notNull(),
    /** The membership that answered; null once that person has left. */
    memberId: uuid("member_id"),
    state: coordinationParticipationState("state").notNull(),
    /**
     * How many people the association expects to bring. A count, not a list:
     * who exactly attends is member personal data and stays out of a table other
     * organisations can read.
     */
    expectedAttendees: smallint("expected_attendees"),
    /** A note to the host — "we can bring the van". Never personal data. */
    note: text("note"),
    respondedAt: timestamp("responded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [
    check(
      "coordination_event_participation_attendees_check",
      sql`${t.expectedAttendees} is null or (${t.expectedAttendees} >= 0 and ${t.expectedAttendees} <= 500)`,
    ),
    // One answer per organisation per thing answered about. Two partial uniques
    // rather than one on `(event_id, occurrence_id, organization_id)`, because a
    // unique index treats every null occurrence as distinct — an association
    // could answer the series twice and Postgres would allow both.
    uniqueIndex("coordination_event_participation_event_uq")
      .on(t.eventId, t.organizationId)
      .where(sql`${t.occurrenceId} is null`),
    uniqueIndex("coordination_event_participation_occurrence_uq")
      .on(t.occurrenceId, t.organizationId)
      .where(sql`${t.occurrenceId} is not null`),
    foreignKey({
      name: "coordination_event_participation_event_fk",
      columns: [t.eventId],
      foreignColumns: [coordinationEvents.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "coordination_event_participation_org_fk",
      columns: [t.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    // A single-column key, and the pair is *not* guarded by a composite one.
    // That is a tool limit, not a preference: the composite key would need a
    // unique on `coordination_event_occurrences (id, event_id)`, and
    // `drizzle-kit push` can maintain neither form of it — it emits foreign keys
    // before indexes, so a unique index is not there yet when the key is created,
    // and it re-creates composite unique constraints on every run, which fails
    // once a key depends on one. Until the Stage 0 baseline replaces push with
    // reviewed migrations, "the occurrence answered about belongs to the event
    // answered about" is enforced by the trigger listed in
    // docs/SCHEMA-DELIVERY-PLAN.md §2.3, not by the key.
    foreignKey({
      name: "coordination_event_participation_occurrence_fk",
      columns: [t.occurrenceId],
      foreignColumns: [coordinationEventOccurrences.id],
    }).onDelete("cascade"),
    // `restrict`, not `set null`: this row's organisation is not nullable, so a
    // cascade that blanked the pair would fail anyway. A membership that answered
    // for its association is removed by clearing `member_id` first — the answer
    // belongs to the organisation and outlives the person who gave it.
    foreignKey({
      name: "coordination_event_participation_member_scope_fk",
      columns: [t.memberId, t.organizationId],
      foreignColumns: [
        organizationMembers.id,
        organizationMembers.organizationId,
      ],
    }).onDelete("restrict"),
    // The host's own screen: "who is coming to this?"
    index("coordination_event_participation_event_state_idx").on(
      t.eventId,
      t.state,
    ),
    // The association's own screen: "what have we said yes to?"
    index("coordination_event_participation_org_idx").on(
      t.organizationId,
      t.respondedAt,
    ),
  ],
);

/**
 * Authored text per language, the same lightweight pattern as
 * `content.place_translations`: the source language is required and the others
 * are filled in as they are written. A public-tier event without a reader's
 * language falls back to the source rather than blanking.
 */
export const coordinationEventTranslations = operations.table(
  "coordination_event_translations",
  {
    // Named explicitly: the generated name overruns 63 bytes (./schemas.ts).
    eventId: uuid("event_id").notNull(),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    /** Why a cancelled event was cancelled — shown wherever it is shown. */
    cancellationReason: text("cancellation_reason"),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.languageCode] }),
    foreignKey({
      columns: [t.eventId],
      foreignColumns: [coordinationEvents.id],
      name: "coordination_event_translations_event_id_fk",
    }).onDelete("cascade"),
  ],
);

/**
 * How to get to one event on public transport — the same rows as
 * `content.activity_transit_links`, kept beside the event for the same reason:
 * an event's location is very often a free-text meeting point with no place
 * record behind it, and it is the person writing the event who knows which bus
 * gets there.
 *
 * Read by whoever may read the event. Like the event's text and its flyers,
 * these rows inherit `visibility` rather than carrying their own — an
 * `organization`-tier event's directions stay inside the host without anyone
 * having to remember that.
 */
export const coordinationEventTransitLinks = operations.table(
  "coordination_event_transit_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Named explicitly: the generated name overruns 63 bytes (./schemas.ts).
    eventId: uuid("event_id").notNull(),
    mode: transitMode("mode").notNull(),
    /** The line as the network prints it — "5", "TER 12", "C1". */
    line: varchar("line", { length: 40 }),
    /** The stop or station to get off at, in the network's own spelling. */
    stopName: varchar("stop_name", { length: 120 }),
    /** Minutes on foot from that stop; null when nobody has measured it. */
    walkMinutes: smallint("walk_minutes"),
    displayOrder: integer("display_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    // A row that names neither a line nor a stop tells a reader nothing.
    check(
      "coordination_event_transit_links_detail_check",
      sql`${t.line} is not null or ${t.stopName} is not null`,
    ),
    check(
      "coordination_event_transit_links_walk_check",
      sql`${t.walkMinutes} is null or (${t.walkMinutes} >= 0 and ${t.walkMinutes} <= 240)`,
    ),
    index("coordination_event_transit_links_event_order_idx").on(
      t.eventId,
      t.displayOrder,
    ),
    foreignKey({
      columns: [t.eventId],
      foreignColumns: [coordinationEvents.id],
      name: "coordination_event_transit_links_event_id_fk",
    }).onDelete("cascade"),
  ],
);

/**
 * The event's own media: one `cover` image and any number of `flyer` documents
 * people can download and print. Files live in `content.assets` like every
 * other upload, so rights confirmation and the safety scan are the same gate
 * here as everywhere else (docs/DATABASE-SCHEMA.md §9).
 *
 * Nothing about publication is stored on this row: whether a reader may fetch
 * the file is answered by the event's `visibility`, exactly as for the event's
 * own text. A flyer of an `organization`-tier event is therefore workspace-only
 * without anyone having to remember to say so.
 */
export const coordinationEventAssets = operations.table(
  "coordination_event_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => coordinationEvents.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    /** `cover` for the image, `flyer` for a downloadable document. */
    role: varchar("role", { length: 50 }).notNull(),
    /** The language the file itself is in — a flyer is printed in one. */
    languageCode: varchar("language_code", { length: 35 }).references(
      () => languages.code,
    ),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("coordination_event_assets_event_asset_role_uq").on(
      t.eventId,
      t.assetId,
      t.role,
    ),
    index("coordination_event_assets_event_role_idx").on(t.eventId, t.role),
  ],
);
