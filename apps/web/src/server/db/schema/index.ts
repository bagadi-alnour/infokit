/**
 * Phase 0/1/2 schema — the single source of truth.
 * Implements the docs/DATABASE-SCHEMA.md subset for PRODUCT.md Phases 0–2;
 * later slices extend this additively. Deliberately absent, waiting for
 * their evidence triggers (PRODUCT.md §8.1): the sealed-revision
 * joint-publication engine (§11 of the schema doc), the notification outbox,
 * and Phase 3+ (documents, inventory, internal planning). The `operations`
 * schema opens early with two pieces only: the shared coordination agenda of
 * §13, and the skills and courses of §12 with the per-person records that hang
 * off them and the requirement sets a mission will point at.
 *
 * Phase 2 (docs/SCHEMA-DELIVERY-PLAN.md §2) adds recurrence and participation to
 * the agenda, editorial custody transfer, speciality change review, moderation
 * cases, permission review, and the notification endpoints and in-app bell that
 * the delivery ledger has been shipping without.
 */
export * from "./schemas";
export * from "./auth";
export * from "./catalog";
export * from "./account-settings";
export * from "./taxonomies";
export * from "./tags";
export * from "./organizations";
export * from "./places";
export * from "./activities";
export * from "./services";
export * from "./translators";
export * from "./access";
export * from "./assets";
export * from "./courses";
export * from "./skills";
export * from "./editorial";
export * from "./translation-sources";
export * from "./translation-assignments";
export * from "./events";
export * from "./coordination";
export * from "./search";
export * from "./simulator";
export * from "./moderation";
export * from "./audit-log";
export * from "./notifications";
