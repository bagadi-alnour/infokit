import assert from "node:assert/strict";
import test from "node:test";

import {
  hasScheduleRuleOverlap,
  scheduleRulesOverlap,
} from "./schedule-overlap";

void test("split-day schedule blocks may share a weekday without overlapping", () => {
  assert.equal(
    scheduleRulesOverlap(
      { weekday: 1, startTime: "09:00", endTime: "12:00" },
      { weekday: 1, startTime: "14:00", endTime: "17:00" },
    ),
    false,
  );
});

void test("adjacent schedule blocks are accepted", () => {
  assert.equal(
    scheduleRulesOverlap(
      { weekday: 1, startTime: "09:00", endTime: "12:00" },
      { weekday: 1, startTime: "12:00", endTime: "14:00" },
    ),
    false,
  );
});

void test("overlapping split-day blocks are rejected", () => {
  assert.equal(
    hasScheduleRuleOverlap(
      { weekday: 1, startTime: "11:30", endTime: "14:00" },
      [
        { weekday: 1, startTime: "09:00", endTime: "12:00" },
        { weekday: 1, startTime: "14:00", endTime: "17:00" },
      ],
    ),
    true,
  );
});

void test("overnight blocks overlap the following weekday", () => {
  assert.equal(
    scheduleRulesOverlap(
      {
        weekday: 1,
        startTime: "22:00",
        endTime: "02:00",
        endsNextDay: true,
      },
      { weekday: 2, startTime: "01:00", endTime: "03:00" },
    ),
    true,
  );
});

void test("Sunday overnight blocks wrap into Monday", () => {
  assert.equal(
    scheduleRulesOverlap(
      {
        weekday: 7,
        startTime: "23:00",
        endTime: "01:00",
        endsNextDay: true,
      },
      { weekday: 1, startTime: "00:30", endTime: "02:00" },
    ),
    true,
  );
});
