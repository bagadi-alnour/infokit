import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePersonRequirement,
  evaluateRequirements,
  isGroupEligible,
  type HeldEntry,
  type PersonHoldings,
  type RequirementSpec,
} from "./requirement-matching";

const TODAY = "2026-07-28";

function requirement(over: Partial<RequirementSpec> = {}): RequirementSpec {
  return {
    id: "r1",
    target: { kind: "skill", id: "permit-b" },
    necessity: "required",
    mustBeVerified: false,
    mustBeCurrent: true,
    minimumCount: null,
    ...over,
  };
}

function person(personId: string, held: HeldEntry[]): PersonHoldings {
  return { personId, held };
}

void test("a selected skill meets a requirement that asks for no proof", () => {
  assert.equal(
    evaluatePersonRequirement(
      requirement(),
      person("ana", [
        {
          kind: "skill",
          id: "permit-b",
          state: "self_declared",
          expiresOn: null,
        },
      ]),
      TODAY,
    ),
    "met",
  );
});

void test("holding nothing, or a refused declaration, is a missing requirement", () => {
  assert.equal(
    evaluatePersonRequirement(requirement(), person("ana", []), TODAY),
    "missing",
  );
  assert.equal(
    evaluatePersonRequirement(
      requirement(),
      person("ana", [
        { kind: "skill", id: "permit-b", state: "rejected", expiresOn: null },
      ]),
      TODAY,
    ),
    "missing",
  );
});

void test("a requirement that wants proof reads someone's own word as unverified", () => {
  const spec = requirement({ mustBeVerified: true });
  assert.equal(
    evaluatePersonRequirement(
      spec,
      person("ana", [
        {
          kind: "skill",
          id: "permit-b",
          state: "self_declared",
          expiresOn: null,
        },
      ]),
      TODAY,
    ),
    "unverified",
  );
  assert.equal(
    evaluatePersonRequirement(
      spec,
      person("ana", [
        { kind: "skill", id: "permit-b", state: "verified", expiresOn: null },
      ]),
      TODAY,
    ),
    "met",
  );
});

void test("a lapsed date is expired, unless the requirement accepts an old one", () => {
  const held: HeldEntry[] = [
    {
      kind: "course",
      id: "psc1",
      state: "verified",
      expiresOn: "2026-01-01",
    },
  ];
  const target = { kind: "course", id: "psc1" } as const;
  assert.equal(
    evaluatePersonRequirement(
      requirement({ target }),
      person("ana", held),
      TODAY,
    ),
    "expired",
  );
  assert.equal(
    evaluatePersonRequirement(
      requirement({ target, mustBeCurrent: false }),
      person("ana", held),
      TODAY,
    ),
    "met",
  );
});

void test("a spoken language is met by holding it — nothing to verify or renew", () => {
  assert.equal(
    evaluatePersonRequirement(
      requirement({
        target: { kind: "language", code: "ps" },
        mustBeVerified: true,
      }),
      person("ana", [{ kind: "language", code: "ps" }]),
      TODAY,
    ),
    "met",
  );
});

void test("a minimum count is met by part of the group", () => {
  const spec = requirement({ minimumCount: 2 });
  const group = [
    person("ana", [
      { kind: "skill", id: "permit-b", state: "verified", expiresOn: null },
    ]),
    person("ben", [
      { kind: "skill", id: "permit-b", state: "verified", expiresOn: null },
    ]),
    person("cleo", []),
  ];
  const [outcome] = evaluateRequirements([spec], group, TODAY);
  assert.ok(outcome);
  assert.equal(outcome.status, "met");
  assert.equal(outcome.needed, 2);
  assert.equal(outcome.met, 2);
  assert.deepEqual(outcome.holders, ["ana", "ben"]);
  assert.equal(outcome.gaps.length, 1);
});

void test("without a minimum, everyone assigned needs it", () => {
  const group = [
    person("ana", [
      { kind: "skill", id: "permit-b", state: "verified", expiresOn: null },
    ]),
    person("ben", []),
  ];
  const [outcome] = evaluateRequirements([requirement()], group, TODAY);
  assert.ok(outcome);
  assert.equal(outcome.status, "missing");
  assert.equal(outcome.needed, 2);
  assert.equal(outcome.met, 1);
});

void test("a short group reports the most actionable gap first", () => {
  const spec = requirement({ mustBeVerified: true, minimumCount: 2 });
  const expiring = [
    person("ana", [
      {
        kind: "skill",
        id: "permit-b",
        state: "verified",
        expiresOn: "2020-01-01",
      },
    ]),
    person("ben", [
      {
        kind: "skill",
        id: "permit-b",
        state: "self_declared",
        expiresOn: null,
      },
    ]),
  ];
  assert.equal(
    evaluateRequirements([spec], expiring, TODAY)[0]?.status,
    "expired",
  );
  const unverified = [
    person("ben", [
      {
        kind: "skill",
        id: "permit-b",
        state: "self_declared",
        expiresOn: null,
      },
    ]),
    person("cleo", []),
  ];
  assert.equal(
    evaluateRequirements([spec], unverified, TODAY)[0]?.status,
    "unverified",
  );
});

void test("an empty group meets nothing", () => {
  const [outcome] = evaluateRequirements([requirement()], [], TODAY);
  assert.ok(outcome);
  assert.equal(outcome.status, "missing");
  assert.equal(outcome.needed, 0);
});

void test("only required gaps block the group", () => {
  const specs = [
    requirement({ id: "must", target: { kind: "skill", id: "permit-b" } }),
    requirement({
      id: "nice",
      necessity: "preferred",
      target: { kind: "skill", id: "mano" },
    }),
  ];
  const group = [
    person("ana", [
      { kind: "skill", id: "permit-b", state: "verified", expiresOn: null },
    ]),
  ];
  const outcomes = evaluateRequirements(specs, group, TODAY);
  assert.equal(outcomes[1]?.status, "missing");
  assert.equal(isGroupEligible(specs, outcomes), true);
  const blocked = evaluateRequirements(specs, [person("ben", [])], TODAY);
  assert.equal(isGroupEligible(specs, blocked), false);
});
