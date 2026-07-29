import assert from "node:assert/strict";
import test from "node:test";

import {
  auditQueryString,
  EMPTY_AUDIT_QUERY,
  hasAuditFilters,
  parseAuditQuery,
} from "./audit-filters";

void test("an empty URL reads the events view, unfiltered", () => {
  assert.deepEqual(parseAuditQuery({}), EMPTY_AUDIT_QUERY);
  assert.equal(hasAuditFilters(parseAuditQuery({})), false);
});

void test("a value outside an enum is no filter at all", () => {
  const query = parseAuditQuery({
    view: "deliveries",
    outcome: "denied",
    severity: "catastrophic",
    status: "'; drop table audit.events; --",
  });
  assert.equal(query.view, "deliveries");
  assert.equal(query.outcome, "denied");
  assert.equal(query.severity, "");
  assert.equal(query.status, "");
});

void test("an unknown view falls back to the events ledger", () => {
  assert.equal(parseAuditQuery({ view: "everything" }).view, "events");
});

void test("free text is trimmed and capped", () => {
  const query = parseAuditQuery({
    actor: "  bagadi@example.com  ",
    action: "x".repeat(400),
  });
  assert.equal(query.actor, "bagadi@example.com");
  assert.equal(query.action.length, 120);
});

void test("a repeated parameter is read once", () => {
  assert.equal(parseAuditQuery({ actor: ["first", "second"] }).actor, "first");
});

void test("a date filter is a calendar day or nothing", () => {
  const query = parseAuditQuery({ from: "2026-07-01", to: "last tuesday" });
  assert.equal(query.from, "2026-07-01");
  assert.equal(query.to, "");
});

void test("the page number is a positive integer within reach", () => {
  assert.equal(parseAuditQuery({ page: "3" }).page, 3);
  assert.equal(parseAuditQuery({ page: "0" }).page, 1);
  assert.equal(parseAuditQuery({ page: "-2" }).page, 1);
  assert.equal(parseAuditQuery({ page: "many" }).page, 1);
  assert.equal(parseAuditQuery({ page: "99999" }).page, 1000);
});

void test("a link carries only the filters that were chosen", () => {
  const query = parseAuditQuery({ outcome: "denied", page: "2" });
  assert.equal(auditQueryString(query), "?outcome=denied&page=2");
  assert.equal(auditQueryString(query, { page: 1 }), "?outcome=denied");
  assert.equal(auditQueryString(EMPTY_AUDIT_QUERY), "");
});

void test("switching view keeps the filters and returns to the first page", () => {
  const query = parseAuditQuery({ outcome: "failure", page: "4" });
  assert.equal(
    auditQueryString(query, { view: "deliveries", page: 1 }),
    "?view=deliveries&outcome=failure",
  );
});

void test("a filtered list knows it is filtered", () => {
  assert.equal(hasAuditFilters(parseAuditQuery({ page: "2" })), false);
  assert.equal(hasAuditFilters(parseAuditQuery({ actor: "sam" })), true);
  assert.equal(hasAuditFilters(parseAuditQuery({ from: "2026-07-01" })), true);
});
