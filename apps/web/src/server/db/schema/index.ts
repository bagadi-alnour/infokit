/**
 * Slice 0 schema — the single source of truth.
 * Implements the docs/DATABASE-SCHEMA.md subset for PRODUCT.md §8.1 Slice 0;
 * later slices extend this additively (simulator, editorial, publishing…).
 */
export * from "./schemas";
export * from "./auth";
export * from "./catalog";
export * from "./taxonomies";
export * from "./organizations";
export * from "./places";
export * from "./services";
