import assert from "node:assert/strict";
import test from "node:test";

import {
  googleMapsHref,
  verificationFormatters,
  verifiedAgoLabel,
} from "./activity-presentation";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A fixed instant, so every expectation below is about the elapsed time. */
const NOW = Date.parse("2026-07-28T12:00:00Z");

/** How the card would read `age` milliseconds after the check, in `locale`. */
function label(age: number, locale: "en" | "fr" | "ar" = "en") {
  return verifiedAgoLabel({
    verifiedAt: new Date(NOW - age),
    format: verificationFormatters(locale).ago,
    now: NOW,
  });
}

void test("a check just made reads as a minute, not as seconds", () => {
  // The payload is rendered on the server and cached, so seconds would be a
  // claim that is false before it is read.
  assert.equal(label(0), "1 minute ago");
  assert.equal(label(20_000), "1 minute ago");
  assert.equal(label(90_000), "2 minutes ago");
});

void test("the unit grows with the age", () => {
  assert.equal(label(45 * MINUTE_MS), "45 minutes ago");
  assert.equal(label(3 * HOUR_MS), "3 hours ago");
  assert.equal(label(3 * DAY_MS), "3 days ago");
  assert.equal(label(20 * DAY_MS), "3 weeks ago");
  assert.equal(label(100 * DAY_MS), "3 months ago");
  assert.equal(label(800 * DAY_MS), "2 years ago");
});

void test("each boundary hands over to the next unit", () => {
  // A single step of one unit is named rather than counted, which is what
  // `numeric: "auto"` is for: "yesterday", not "1 day ago".
  assert.equal(label(HOUR_MS - 1), "60 minutes ago");
  assert.equal(label(HOUR_MS), "1 hour ago");
  assert.equal(label(DAY_MS - 1), "24 hours ago");
  assert.equal(label(DAY_MS), "yesterday");
  assert.equal(label(7 * DAY_MS - 1), "7 days ago");
  assert.equal(label(7 * DAY_MS), "last week");
});

void test("a clock that is behind the record never reports the future", () => {
  // Two servers a second apart is enough for this, and "in 1 minute" beside
  // "Last verified" would read as a promise rather than a check.
  assert.equal(label(-5_000), "1 minute ago");
});

void test("the age is written in the reader's own language", () => {
  assert.equal(label(3 * DAY_MS, "fr"), "il y a 3 jours");
  assert.equal(label(3 * DAY_MS, "ar"), "قبل 3 أيام");
});

void test("yesterday is named rather than counted", () => {
  // `numeric: "auto"` is what makes this read like a person wrote it.
  assert.equal(label(DAY_MS + HOUR_MS), "yesterday");
  assert.equal(label(2 * DAY_MS), "2 days ago");
});

void test("an exact place goes to Google Maps as coordinates", () => {
  assert.equal(
    googleMapsHref({
      address: "12 rue Royale, Calais",
      latitude: 50.9513,
      longitude: 1.8587,
    }),
    "https://www.google.com/maps/search/?api=1&query=50.9513%2C1.8587",
  );
});

void test("a place without coordinates goes as a search of its address", () => {
  assert.equal(
    googleMapsHref({
      address: "12 rue Royale, Calais",
      latitude: null,
      longitude: null,
    }),
    "https://www.google.com/maps/search/?api=1&query=12%20rue%20Royale%2C%20Calais",
  );
});

void test("a place that is neither exact nor addressed has no map link", () => {
  // An area-only or contact-to-learn record: a search of "" would open Maps on
  // nothing, which reads as a broken button.
  assert.equal(
    googleMapsHref({ address: "   ", latitude: null, longitude: null }),
    null,
  );
});

void test("the date beside the age is the city's own wall clock", () => {
  // A check made just after midnight in Paris is still the 28th on the card,
  // whatever the server's own zone says (docs/DESIGN-SYSTEM.md §1).
  const justAfterMidnightInParis = new Date("2026-07-27T22:30:00Z");
  assert.equal(
    verificationFormatters("en").date.format(justAfterMidnightInParis),
    "Jul 28, 2026",
  );
});
