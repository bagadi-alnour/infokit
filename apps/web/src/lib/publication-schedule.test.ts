import assert from "node:assert/strict";
import test from "node:test";

import {
  isScheduledPublication,
  parseScheduledPublication,
} from "~/server/content/publication-schedule";

const now = new Date("2026-07-23T10:00:00.000Z");

for (const mode of ["draft", "now"] as const) {
  void test(`${mode} publication does not create a schedule`, () => {
    assert.equal(
      parseScheduledPublication(mode, "2026-07-24T10:00:00.000Z", now),
      null,
    );
  });
}

void test("a future absolute publication time is accepted", () => {
  assert.deepEqual(
    parseScheduledPublication("scheduled", "2026-07-24T10:00:00.000Z", now),
    new Date("2026-07-24T10:00:00.000Z"),
  );
});

for (const value of [null, "", "not-a-date", "2026-07-23T10:00:00.000Z"]) {
  void test("an absent, invalid, or non-future scheduled time is rejected", () => {
    assert.throws(() => parseScheduledPublication("scheduled", value, now));
  });
}

void test("pending and activated scheduled publications are distinguished", () => {
  assert.equal(
    isScheduledPublication(new Date("2026-07-24T10:00:00.000Z"), now),
    true,
  );
  assert.equal(
    isScheduledPublication(new Date("2026-07-23T09:59:59.000Z"), now),
    false,
  );
});
