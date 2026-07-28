import assert from "node:assert/strict";
import test from "node:test";

import { scheduleRowsIssue } from "./schedule-rules";

void test("an end time before its start is rejected", () => {
  assert.equal(
    scheduleRowsIssue("recurring", [
      { weekday: 1, startTime: "17:00", endTime: "09:00" },
    ]),
    "invalidRange",
  );
});

void test("hours crossing midnight are accepted", () => {
  assert.equal(
    scheduleRowsIssue("recurring", [
      { weekday: 1, startTime: "21:00", endTime: "01:00", endsNextDay: true },
    ]),
    null,
  );
});

void test("two new rows colliding with each other are rejected", () => {
  assert.equal(
    scheduleRowsIssue("recurring", [
      { weekday: 2, startTime: "09:00", endTime: "12:00" },
      { weekday: 2, startTime: "11:00", endTime: "13:00" },
    ]),
    "overlap",
  );
});

void test("a new row colliding with an existing rule is rejected", () => {
  assert.equal(
    scheduleRowsIssue(
      "recurring",
      [{ weekday: 3, startTime: "10:00", endTime: "11:00" }],
      [{ weekday: 3, startTime: "09:00", endTime: "12:00" }],
    ),
    "overlap",
  );
});

void test("adjacent rows on the same weekday are accepted", () => {
  assert.equal(
    scheduleRowsIssue("recurring", [
      { weekday: 4, startTime: "09:00", endTime: "12:00" },
      { weekday: 4, startTime: "12:00", endTime: "14:00" },
    ]),
    null,
  );
});

void test("a one-off date only has its range checked", () => {
  assert.equal(
    scheduleRowsIssue(
      "one_off",
      [{ weekday: 1, startTime: "09:00", endTime: "12:00" }],
      [{ weekday: 1, startTime: "09:00", endTime: "12:00" }],
    ),
    null,
  );
});
