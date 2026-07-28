import assert from "node:assert/strict";
import test from "node:test";

import { attentionKindOf, freshnessOf } from "./freshness";

const DAY_MS = 24 * 60 * 60 * 1000;
const verified = new Date(Date.now() - 3 * DAY_MS);

void test("a record with no verification is never fresh", () => {
  assert.equal(
    freshnessOf({ lastVerifiedAt: null, reviewDueAt: null }),
    "never",
  );
  assert.equal(
    attentionKindOf({
      manualStatus: "normal",
      lastVerifiedAt: null,
      reviewDueAt: null,
      hasSchedule: true,
    }),
    "never",
  );
});

void test("a manual uncertain flag outranks every freshness state", () => {
  assert.equal(
    attentionKindOf({
      manualStatus: "uncertain",
      lastVerifiedAt: new Date(),
      reviewDueAt: new Date(Date.now() + 30 * DAY_MS),
      hasSchedule: true,
    }),
    "uncertain",
  );
});

void test("a record with no recurring hours is reported before its freshness", () => {
  assert.equal(
    attentionKindOf({
      manualStatus: "normal",
      lastVerifiedAt: null,
      reviewDueAt: null,
      hasSchedule: false,
    }),
    "noSchedule",
  );
});

void test("a review date in the past is overdue, inside the week is due soon", () => {
  assert.equal(
    attentionKindOf({
      manualStatus: "normal",
      lastVerifiedAt: verified,
      reviewDueAt: new Date(Date.now() - DAY_MS),
      hasSchedule: true,
    }),
    "overdue",
  );
  assert.equal(
    attentionKindOf({
      manualStatus: "normal",
      lastVerifiedAt: verified,
      reviewDueAt: new Date(Date.now() + 3 * DAY_MS),
      hasSchedule: true,
    }),
    "dueSoon",
  );
});

void test("a scheduled record reviewed well within its window is quiet", () => {
  assert.equal(
    attentionKindOf({
      manualStatus: "normal",
      lastVerifiedAt: verified,
      reviewDueAt: new Date(Date.now() + 30 * DAY_MS),
      hasSchedule: true,
    }),
    null,
  );
});
