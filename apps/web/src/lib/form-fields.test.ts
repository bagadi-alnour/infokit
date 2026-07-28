import assert from "node:assert/strict";
import test from "node:test";

import {
  optionalNumber,
  optionalText,
  optionalTextUpTo,
  optionalUuid,
} from "./form-fields";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

void test("reads a blank field as absent, not as an empty value", () => {
  assert.equal(optionalText.parse(""), null);
  assert.equal(optionalText.parse("   "), null);
  assert.equal(optionalUuid.parse(""), null);
  assert.equal(optionalNumber.parse(""), null);
  assert.equal(optionalTextUpTo(10).parse(""), null);
});

void test("keeps a filled field, trimmed", () => {
  assert.equal(optionalText.parse("  Calais  "), "Calais");
  assert.equal(optionalUuid.parse(` ${uuid} `), uuid);
  assert.equal(optionalNumber.parse(" 50.95 "), 50.95);
  assert.equal(optionalNumber.parse("-1.85"), -1.85);
});

void test("rejects a malformed value instead of dropping it", () => {
  // Quietly nulling these would lose what the editor typed without telling them.
  assert.equal(optionalUuid.safeParse("not-an-id").success, false);
  assert.equal(optionalNumber.safeParse("north").success, false);
  assert.equal(optionalNumber.safeParse("Infinity").success, false);
  assert.equal(optionalTextUpTo(3).safeParse("four").success, false);
});
