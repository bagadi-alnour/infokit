import assert from "node:assert/strict";
import test from "node:test";

import {
  activityCurrentStatus,
  nextOpening,
  type PublicScheduleRule,
} from "./activity-current-status";

const mondayRule: PublicScheduleRule = {
  weekday: 1,
  startTime: "09:00:00",
  endTime: "17:00:00",
  endsNextDay: false,
  validFrom: null,
  validTo: null,
};

void test("reports open during a current Paris schedule window", () => {
  assert.equal(
    activityCurrentStatus({
      now: new Date("2026-07-20T10:00:00Z"),
      manualStatus: "normal",
      rules: [mondayRule],
      exceptions: [],
    }),
    "open",
  );
});

void test("reports closed outside the current schedule window", () => {
  assert.equal(
    activityCurrentStatus({
      now: new Date("2026-07-20T18:00:00Z"),
      manualStatus: "normal",
      rules: [mondayRule],
      exceptions: [],
    }),
    "closed",
  );
});

void test("a full-day closure overrides the usual schedule", () => {
  assert.equal(
    activityCurrentStatus({
      now: new Date("2026-07-20T10:00:00Z"),
      manualStatus: "normal",
      rules: [mondayRule],
      exceptions: [
        {
          date: "2026-07-20",
          kind: "closure",
          startTime: null,
          endTime: null,
        },
      ],
    }),
    "closed",
  );
});

void test("an exceptional opening can open an otherwise closed activity", () => {
  assert.equal(
    activityCurrentStatus({
      now: new Date("2026-07-21T10:00:00Z"),
      manualStatus: "normal",
      rules: [mondayRule],
      exceptions: [
        {
          date: "2026-07-21",
          kind: "exceptional_opening",
          startTime: "11:00:00",
          endTime: "14:00:00",
        },
      ],
    }),
    "open",
  );
});

void test("overnight schedule windows remain open after midnight", () => {
  assert.equal(
    activityCurrentStatus({
      now: new Date("2026-07-21T00:30:00Z"),
      manualStatus: "normal",
      rules: [
        {
          weekday: 1,
          startTime: "22:00:00",
          endTime: "03:00:00",
          endsNextDay: true,
          validFrom: null,
          validTo: null,
        },
      ],
      exceptions: [],
    }),
    "open",
  );
});

void test("manual uncertainty takes precedence over schedule data", () => {
  assert.equal(
    activityCurrentStatus({
      now: new Date("2026-07-20T10:00:00Z"),
      manualStatus: "uncertain",
      rules: [mondayRule],
      exceptions: [],
    }),
    "uncertain",
  );
});

// 2026-07-20 is a Monday; 10:00Z ≈ 12:00 Paris (CEST, UTC+2).
void test("next opening later today when before the window", () => {
  const result = nextOpening({
    now: new Date("2026-07-20T05:00:00Z"), // 07:00 Paris, before 09:00
    rules: [mondayRule],
  });
  assert.deepEqual(result, { weekday: 1, time: "09:00", daysAhead: 0 });
});

void test("next opening is tomorrow when today's window has passed", () => {
  const tuesdayRule: PublicScheduleRule = {
    ...mondayRule,
    weekday: 2,
    startTime: "10:00:00",
  };
  const result = nextOpening({
    now: new Date("2026-07-20T18:00:00Z"), // Monday 20:00 Paris, after close
    rules: [tuesdayRule],
  });
  assert.deepEqual(result, { weekday: 2, time: "10:00", daysAhead: 1 });
});

void test("next opening rolls to next week for a single weekly rule", () => {
  const result = nextOpening({
    now: new Date("2026-07-20T18:00:00Z"), // Monday evening
    rules: [mondayRule],
  });
  assert.deepEqual(result, { weekday: 1, time: "09:00", daysAhead: 7 });
});

void test("no next opening when there are no rules", () => {
  assert.equal(
    nextOpening({ now: new Date("2026-07-20T18:00:00Z"), rules: [] }),
    null,
  );
});
