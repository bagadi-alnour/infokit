import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WALK_MINUTES,
  TRANSIT_CARRIED_FIELD,
  TRANSIT_FIELDS,
  parseTransitLinks,
  transitLinksPatch,
} from "./transit-links";
import { presentTransitLinks } from "./transit-presentation";

/** A form as the browser posts it: one repeated key per column, row by row. */
function post(
  rows: Array<[mode: string, line: string, stop: string, walk: string]>,
  options: { carried?: boolean } = {},
) {
  const formData = new FormData();
  if (options.carried !== false) formData.set(TRANSIT_CARRIED_FIELD, "1");
  for (const [mode, line, stop, walk] of rows) {
    formData.append(TRANSIT_FIELDS.mode, mode);
    formData.append(TRANSIT_FIELDS.line, line);
    formData.append(TRANSIT_FIELDS.stopName, stop);
    formData.append(TRANSIT_FIELDS.walkMinutes, walk);
  }
  return formData;
}

void test("reads the repeated keys back as rows, in the order shown", () => {
  const links = parseTransitLinks(
    post([
      ["bus", "5", "Théâtre", "4"],
      ["train", "", "Calais-Ville", "12"],
    ]),
  );
  assert.deepEqual(links, [
    { mode: "bus", line: "5", stopName: "Théâtre", walkMinutes: 4 },
    { mode: "train", line: null, stopName: "Calais-Ville", walkMinutes: 12 },
  ]);
});

void test("drops a row the editor added and never filled in", () => {
  // The one mistake here that costs nothing to make, so it costs nothing.
  const links = parseTransitLinks(
    post([
      ["bus", "", "  ", ""],
      ["metro", "M1", "", ""],
    ]),
  );
  assert.deepEqual(links, [
    { mode: "metro", line: "M1", stopName: null, walkMinutes: null },
  ]);
});

void test("rejects what the form said it would reject", () => {
  // A mode outside the enum, or a walk longer than the check constraint allows,
  // can only come from a tampered or stale form — never from the fieldset.
  assert.throws(() =>
    parseTransitLinks(post([["hovercraft", "", "Port", ""]])),
  );
  assert.throws(() =>
    parseTransitLinks(post([["bus", "5", "", String(MAX_WALK_MINUTES + 1)]])),
  );
  assert.throws(() => parseTransitLinks(post([["bus", "5", "", "soon"]])));
});

void test("a screen that never showed the fieldset leaves the rows alone", () => {
  // `undefined` means "do not touch"; an empty list means "the editor removed
  // the last one". Reading both as `[]` would empty a record from a form that
  // never mentioned transport.
  assert.equal(transitLinksPatch(new FormData()), undefined);
  assert.deepEqual(transitLinksPatch(post([], { carried: true })), []);
});

const messages = {
  "transit.mode.bus": "Bus",
  "transit.mode.bike": "Bike",
  "transit.walk": "{minutes} min walk",
};

void test("translates the mode and nothing else", () => {
  const [bus, bike] = presentTransitLinks({
    links: [
      { mode: "bus", line: "5", stopName: "Théâtre", walkMinutes: 4 },
      { mode: "bike", line: null, stopName: "Théâtre", walkMinutes: null },
    ],
    messages,
    locale: "en",
  });
  // The line and the stop are the names printed on the pole.
  assert.deepEqual(bus, {
    mode: "bus",
    modeLabel: "Bus",
    line: "5",
    stopName: "Théâtre",
    walkLabel: "4 min walk",
    label: "Bus 5 · Théâtre · 4 min walk",
  });
  // No line to name and no walk to time: the label says what there is.
  assert.deepEqual(bike, {
    mode: "bike",
    modeLabel: "Bike",
    line: null,
    stopName: "Théâtre",
    walkLabel: null,
    label: "Bike · Théâtre",
  });
});

void test("counts the minutes in the reader's own digits", () => {
  const [link] = presentTransitLinks({
    links: [{ mode: "bus", line: "5", stopName: null, walkMinutes: 12 }],
    messages: { ...messages, "transit.walk": "{minutes} دقيقة سيرًا" },
    locale: "fa",
  });
  assert.equal(link?.label, "Bus 5 · ۱۲ دقيقة سيرًا");
});
