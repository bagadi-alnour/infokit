import {
  index,
  jsonb,
  timestamp,
  uuid,
  varchar,
  text,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { organizations } from "./organizations";
import { audit, auditActorType } from "./schemas";

/**
 * Append-only audit events (docs/DATABASE-SCHEMA.md §17, NFR-006).
 * Never store passwords, tokens, simulator answers, or unrestricted
 * before/after objects in `metadata` — allowlisted safe fields only.
 * Rows are never updated or deleted by application code.
 */
export const auditEvents = audit.table(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    actorUserId: varchar("actor_user_id", { length: 255 }).references(
      () => users.id,
    ),
    actorType: auditActorType("actor_type").notNull().default("user"),
    action: varchar("action", { length: 150 }).notNull(),
    subjectType: varchar("subject_type", { length: 100 }),
    subjectId: varchar("subject_id", { length: 255 }),
    reason: text("reason"),
    metadata: jsonb("metadata"),
    requestId: varchar("request_id", { length: 100 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_events_org_time_idx").on(t.organizationId, t.occurredAt),
    index("audit_events_subject_idx").on(t.subjectType, t.subjectId),
  ],
);
