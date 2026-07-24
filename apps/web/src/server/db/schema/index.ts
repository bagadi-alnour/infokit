/**
 * Phase 0/1 schema — the single source of truth.
 * Implements the docs/DATABASE-SCHEMA.md subset for PRODUCT.md Phases 0–1;
 * later slices extend this additively. Deliberately absent, waiting for
 * their evidence triggers (PRODUCT.md §8.1): the sealed-revision
 * joint-publication engine (§11 of the schema doc), the notifications
 * outbox, tags, and everything Phase 2+ (operations, documents, inventory).
 */
export * from "./schemas";
export * from "./auth";
export * from "./catalog";
export * from "./taxonomies";
export * from "./tags";
export * from "./organizations";
export * from "./places";
export * from "./activities";
export * from "./services";
export * from "./access";
export * from "./assets";
export * from "./editorial";
export * from "./translation-sources";
export * from "./translation-assignments";
export * from "./events";
export * from "./search";
export * from "./simulator";
export * from "./audit-log";
