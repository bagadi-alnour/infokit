import assert from "node:assert/strict";
import test from "node:test";

import { normaliseRecipient, redactRecipient } from "./delivery-recipient";

void test("an email keeps its domain and one letter at each end", () => {
  assert.equal(redactRecipient("bagadi@example.com"), "b•••i@example.com");
  assert.equal(
    redactRecipient("contact@secours-calais.fr"),
    "c•••t@secours-calais.fr",
  );
});

void test("a short local part is masked whole", () => {
  assert.equal(redactRecipient("me@example.com"), "•••@example.com");
});

void test("a phone number keeps its prefix and last two digits", () => {
  assert.equal(redactRecipient("+33612345678"), "+336•••78");
  assert.equal(redactRecipient("06 12 34 56 78"), "061•••78");
});

void test("anything too short to recognise is masked whole", () => {
  assert.equal(redactRecipient(""), "•••");
  assert.equal(redactRecipient("   "), "•••");
  assert.equal(redactRecipient("1234"), "•••");
});

void test("the same address typed two ways normalises to one recipient", () => {
  assert.equal(
    normaliseRecipient("  Bagadi@Example.COM "),
    "bagadi@example.com",
  );
  assert.equal(normaliseRecipient("+33 6 12 34 56 78"), "+33612345678");
});

void test("the mask is computed from the normalised form", () => {
  // Two rows for one address must read as one person, not two: the hash already
  // matches, and the masked column has to agree with it.
  assert.equal(
    redactRecipient("  Bagadi@Example.ORG "),
    redactRecipient("bagadi@example.org"),
  );
  assert.equal(redactRecipient("  Bagadi@Example.ORG "), "b•••i@example.org");
  assert.equal(
    redactRecipient("+33 6 12 34 56 78"),
    redactRecipient("+33612345678"),
  );
});
