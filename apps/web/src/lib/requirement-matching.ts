/**
 * Does this group meet what the mission asks for?
 *
 * A requirement points at a skill, a course, or a spoken language; a person
 * holds selections from the same catalogue. Because both sides are ids, the
 * comparison is arithmetic rather than reading — which is the whole reason
 * declarations are selections and not typed text.
 *
 * Pure on purpose: no database, no clock. The caller passes today's date, so
 * "expired" is testable and a page can ask the same question about a date in
 * the future ("who may do this next month?").
 */

/** `operations.training_record_state`, as the matcher needs to read it. */
export type HeldState =
  | "self_declared"
  | "awaiting_verification"
  | "verified"
  | "rejected"
  | "expired";

export type RequirementTarget =
  | { kind: "skill"; id: string }
  | { kind: "course"; id: string }
  | { kind: "language"; code: string };

export type RequirementSpec = {
  id: string;
  target: RequirementTarget;
  necessity: "required" | "preferred";
  mustBeVerified: boolean;
  mustBeCurrent: boolean;
  /** How many of the group need it; null means every person assigned. */
  minimumCount: number | null;
};

export type HeldEntry =
  | {
      kind: "skill" | "course";
      id: string;
      state: HeldState;
      /** ISO date, or null when it does not expire. */
      expiresOn: string | null;
    }
  | { kind: "language"; code: string };

export type PersonHoldings = {
  /** Whatever the caller identifies a person by: member id, translator id, user id. */
  personId: string;
  held: HeldEntry[];
};

/**
 * Four answers, because they need four different actions: nothing to do,
 * find someone else, ask a verifier, or ask for a renewal.
 */
export type RequirementStatus = "met" | "missing" | "unverified" | "expired";

export type PersonRequirementResult = {
  requirementId: string;
  personId: string;
  status: RequirementStatus;
};

export type RequirementOutcome = {
  requirementId: string;
  status: RequirementStatus;
  /** How many people had to hold it, and how many do. */
  needed: number;
  met: number;
  /** People who satisfy it, and the rest with the reason they do not. */
  holders: string[];
  gaps: PersonRequirementResult[];
};

function matches(entry: HeldEntry, target: RequirementTarget): boolean {
  if (target.kind === "language") {
    return entry.kind === "language" && entry.code === target.code;
  }
  return entry.kind === target.kind && entry.id === target.id;
}

/** One person against one requirement. */
export function evaluatePersonRequirement(
  requirement: RequirementSpec,
  person: PersonHoldings,
  today: string,
): RequirementStatus {
  const entry = person.held.find((held) => matches(held, requirement.target));
  if (!entry) return "missing";
  // A spoken language is the person's own statement; there is nothing to
  // verify or to renew, so holding it is meeting it.
  if (entry.kind === "language") return "met";
  if (entry.state === "rejected") return "missing";
  const lapsed =
    entry.state === "expired" ||
    (entry.expiresOn !== null && entry.expiresOn < today);
  if (requirement.mustBeCurrent && lapsed) return "expired";
  if (requirement.mustBeVerified && entry.state !== "verified") {
    return "unverified";
  }
  return "met";
}

/**
 * The group's shortfall, requirement by requirement.
 *
 * `minimumCount` is how many people need it — "two drivers" on a maraude —
 * and null means everyone. When the count is short, the reported status is the
 * most actionable reason among the people who fall short: a declaration to
 * renew first, then one to verify, and only then "nobody here has it".
 */
export function evaluateRequirements(
  requirements: readonly RequirementSpec[],
  people: readonly PersonHoldings[],
  today: string,
): RequirementOutcome[] {
  return requirements.map((requirement) => {
    const results = people.map((person) => ({
      requirementId: requirement.id,
      personId: person.personId,
      status: evaluatePersonRequirement(requirement, person, today),
    }));
    const holders = results
      .filter((result) => result.status === "met")
      .map((result) => result.personId);
    const gaps = results.filter((result) => result.status !== "met");
    /**
     * Null means everyone assigned — so an empty group meets nothing, which is
     * the honest answer for someone still staffing the mission. A minimum
     * higher than the group size stays unmet for the same reason.
     */
    const needed = requirement.minimumCount ?? people.length;
    const met = holders.length;
    const status: RequirementStatus =
      met >= needed && needed > 0
        ? "met"
        : gaps.some((gap) => gap.status === "expired")
          ? "expired"
          : gaps.some((gap) => gap.status === "unverified")
            ? "unverified"
            : "missing";
    return {
      requirementId: requirement.id,
      status,
      needed,
      met,
      holders,
      gaps,
    };
  });
}

/**
 * True when nothing that blocks is outstanding. A `preferred` gap is not a
 * block — it is what a coordinator would have liked, and it stays visible in
 * the outcome list either way.
 */
export function isGroupEligible(
  requirements: readonly RequirementSpec[],
  outcomes: readonly RequirementOutcome[],
): boolean {
  const required = new Set(
    requirements
      .filter((requirement) => requirement.necessity === "required")
      .map((requirement) => requirement.id),
  );
  return outcomes.every(
    (outcome) =>
      !required.has(outcome.requirementId) || outcome.status === "met",
  );
}
