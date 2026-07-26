import assert from "node:assert/strict";
import test from "node:test";

import {
  instantToZonedFields,
  zonedDateKey,
  zonedWallTimeToInstant,
} from "~/lib/zoned-time";

const paris = "Europe/Paris";

void test("winter wall time resolves at UTC+1", () => {
  assert.equal(
    zonedWallTimeToInstant("2026-01-15", "14:00", paris)?.toISOString(),
    "2026-01-15T13:00:00.000Z",
  );
});

void test("summer wall time resolves at UTC+2", () => {
  assert.equal(
    zonedWallTimeToInstant("2026-07-15", "14:00", paris)?.toISOString(),
    "2026-07-15T12:00:00.000Z",
  );
});

void test("a wall time just after the spring transition keeps its hour", () => {
  // Paris skips 02:00–03:00 on 2026-03-29; 03:00 local is 01:00 UTC.
  assert.equal(
    zonedWallTimeToInstant("2026-03-29", "03:00", paris)?.toISOString(),
    "2026-03-29T01:00:00.000Z",
  );
});

void test("round-tripping an instant returns the wall time it was built from", () => {
  const instant = zonedWallTimeToInstant("2026-10-25", "09:30", paris);
  assert.ok(instant);
  assert.deepEqual(instantToZonedFields(instant, paris), {
    date: "2026-10-25",
    time: "09:30",
  });
});

void test("a late-evening instant belongs to the local day, not the UTC day", () => {
  // 2026-07-15T23:30Z is already the 16th in Paris.
  assert.equal(
    zonedDateKey(new Date("2026-07-15T23:30:00.000Z"), paris),
    "2026-07-16",
  );
});

for (const [date, time] of [
  ["", "14:00"],
  ["2026-02-30", "14:00"],
  ["2026-13-01", "14:00"],
  ["2026-07-15", "25:00"],
  ["2026-07-15", ""],
] as const) {
  void test(`rejects unusable input ${date} ${time}`, () => {
    assert.equal(zonedWallTimeToInstant(date, time, paris), null);
  });
}
