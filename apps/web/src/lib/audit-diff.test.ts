import assert from "node:assert/strict";
import test from "node:test";

import {
  auditChanges,
  formatAuditValue,
  readAuditChanges,
  REDACTED,
  TOO_LARGE,
  TRUNCATED_KEY,
} from "./audit-diff";

void test("only the fields that actually changed are recorded", () => {
  const changes = auditChanges(
    { title: "Douches", city: "calais", active: true },
    { title: "Douches chaudes", city: "calais", active: true },
  );
  assert.deepEqual(changes, {
    title: { from: "Douches", to: "Douches chaudes" },
  });
});

void test("nothing changed means no changes column at all", () => {
  assert.equal(auditChanges({ a: 1 }, { a: 1 }), undefined);
  assert.equal(auditChanges(null, null), undefined);
});

void test("a new or removed value reads against null, not undefined", () => {
  assert.deepEqual(auditChanges(null, { reason: "Fermé" }), {
    reason: { from: null, to: "Fermé" },
  });
  assert.deepEqual(auditChanges({ reason: "Fermé" }, {}), {
    reason: { from: "Fermé", to: null },
  });
});

void test("secrets are reported as changed but never as values", () => {
  const changes = auditChanges(
    {
      passwordHash: "argon2id$old",
      resetToken: "abc",
      twoFactorCode: "123456",
      answers: ["yes", "no"],
      title: "Permanence",
    },
    {
      passwordHash: "argon2id$new",
      resetToken: "def",
      twoFactorCode: "654321",
      answers: ["yes", "yes"],
      title: "Permanence",
    },
  );
  assert.deepEqual(changes, {
    passwordHash: { from: REDACTED, to: REDACTED },
    resetToken: { from: REDACTED, to: REDACTED },
    twoFactorCode: { from: REDACTED, to: REDACTED },
    answers: { from: REDACTED, to: REDACTED },
  });
});

void test("ordinary fields whose names merely contain 'code' stay readable", () => {
  assert.deepEqual(
    auditChanges({ postalCode: "62100" }, { postalCode: "62200" }),
    { postalCode: { from: "62100", to: "62200" } },
  );
  assert.deepEqual(
    auditChanges({ languageCode: "fr" }, { languageCode: "ar" }),
    { languageCode: { from: "fr", to: "ar" } },
  );
});

void test("an explicit field list is an allowlist", () => {
  const changes = auditChanges(
    { title: "A", internalNote: "old" },
    { title: "B", internalNote: "new" },
    { fields: ["title"] },
  );
  assert.deepEqual(changes, { title: { from: "A", to: "B" } });
});

void test("extra masks apply on top of the built-in list", () => {
  const changes = auditChanges(
    { phone: "+33600000000" },
    { phone: "+33611111111" },
    { mask: ["phone"] },
  );
  assert.deepEqual(changes, { phone: { from: REDACTED, to: REDACTED } });
});

void test("the same instant expressed two ways is not a change", () => {
  const iso = "2026-07-28T10:00:00.000Z";
  assert.equal(
    auditChanges({ startsAt: new Date(iso) }, { startsAt: new Date(iso) }),
    undefined,
  );
  assert.deepEqual(
    auditChanges(
      { startsAt: new Date(iso) },
      { startsAt: new Date("2026-07-28T11:00:00.000Z") },
    ),
    {
      startsAt: { from: iso, to: "2026-07-28T11:00:00.000Z" },
    },
  );
});

void test("long text is cut with its true length noted", () => {
  const changes = auditChanges({ body: "a" }, { body: "b".repeat(400) });
  const after = changes?.body?.to;
  assert.ok(typeof after === "string");
  assert.ok(after.endsWith("(+160)"));
  assert.ok(after.length < 400);
});

void test("a jsonb value is readable two levels down", () => {
  const changes = auditChanges(
    { rule: { days: [1, 2], window: { from: "09:00", to: "12:00" } } },
    { rule: { days: [1, 3], window: { from: "09:00", to: "13:00" } } },
  );
  assert.deepEqual(changes?.rule?.to, {
    days: [1, 3],
    window: { from: "09:00", to: "13:00" },
  });
});

void test("below that a structure is named rather than walked", () => {
  const changes = auditChanges(
    { rule: { window: { hours: { open: 9 }, days: [1, 2] } } },
    { rule: { window: { hours: { open: 10 }, days: [1, 2, 3] } } },
  );
  assert.deepEqual(changes?.rule?.to, {
    window: { hours: "[object]", days: "[3 items]" },
  });
});

void test("an oversized value records the change without the value", () => {
  const changes = auditChanges(
    { block: { text: "a".repeat(200) } },
    {
      block: Object.fromEntries(
        Array.from({ length: 20 }, (_, index) => [
          `p${String(index)}`,
          "b".repeat(200),
        ]),
      ),
    },
  );
  assert.equal(changes?.block?.to, TOO_LARGE);
  assert.deepEqual(changes.block.from, {
    text: "a".repeat(200),
  });
});

void test("a very wide change set is capped and says so", () => {
  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  for (let index = 0; index < 50; index += 1) {
    before[`f${String(index)}`] = index;
    after[`f${String(index)}`] = index + 1;
  }
  const changes = auditChanges(before, after);
  assert.ok(changes);
  assert.equal(Object.keys(changes).length, 41);
  assert.equal(changes[TRUNCATED_KEY]?.to, "10 more field(s) not recorded");
});

void test("reading back a stored diff drops anything that is not a change", () => {
  assert.deepEqual(
    readAuditChanges({ title: { from: "A", to: "B" }, junk: "nope" }),
    { title: { from: "A", to: "B" } },
  );
  assert.equal(readAuditChanges(null), null);
  assert.equal(readAuditChanges("string"), null);
  assert.equal(readAuditChanges({}), null);
});

void test("values are formatted for one line, empty distinguished from absent", () => {
  assert.equal(formatAuditValue(null), "—");
  assert.equal(formatAuditValue(""), '""');
  assert.equal(formatAuditValue(false), "false");
  assert.equal(formatAuditValue(12), "12");
  assert.equal(formatAuditValue(["a", "b"]), '["a","b"]');
});
