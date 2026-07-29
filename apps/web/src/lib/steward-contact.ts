import { z } from "zod";

import { optionalTextUpTo } from "~/lib/form-fields";

/**
 * The workspace-only "who to ask about this record" contact, shared by every
 * content type (docs/DATABASE-SCHEMA.md §2). It answers one question an editor
 * in another organisation cannot otherwise answer: this looks wrong — who do I
 * tell? A published correction made without asking is how a wrong opening time
 * becomes a wasted journey.
 *
 * Never selected by a public read model: the columns exist for people with an
 * account, and the console is the only surface that reads them.
 */
export interface StewardContactValues {
  stewardName: string | null;
  stewardPhone: string | null;
  stewardEmail: string | null;
}

/**
 * Somebody the platform can already name, offered as the contact before the
 * free-text fields. A membership carries all three — a name, an address and a
 * number — so choosing one of those fills the whole contact; the person who
 * entered the record carries only the two its account holds. The fields stay
 * editable either way, for the contact who is neither.
 */
export interface StewardCandidate {
  id: string;
  name: string;
  /** The address on file — a roster entry's, or the author's own account. */
  email: string;
  /** The number the roster holds; empty for a candidate with no roster entry. */
  phone: string;
  /** The function they hold in the organisation; empty for an author. */
  title: string;
  /**
   * Where the candidate came from, which is also what the row has to say about
   * them: a colleague on the roster, or whoever entered this record. A record
   * the platform holds itself has no roster, and the author is the one person
   * always worth offering — otherwise the panel names nobody at all.
   */
  source: "member" | "author";
}

/** A record that has no steward yet — what a create form starts from. */
export const EMPTY_STEWARD_CONTACT: StewardContactValues = {
  stewardName: null,
  stewardPhone: null,
  stewardEmail: null,
};

/** The form field names, so a form and its action cannot drift apart. */
export const STEWARD_FIELDS = [
  "stewardName",
  "stewardPhone",
  "stewardEmail",
] as const;

/** Loose on purpose: numbers are written many ways, and any of them can dial. */
const phoneShape = /^[+(]?[\d\s().\-/]{5,}$/;
const emailShape = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export const stewardContactSchema = z.object({
  stewardName: optionalTextUpTo(120),
  stewardPhone: optionalTextUpTo(40).refine(
    (value) => value === null || phoneShape.test(value),
    "Write the contact phone number as digits, spaces and + only",
  ),
  stewardEmail: optionalTextUpTo(255).refine(
    (value) => value === null || emailShape.test(value),
    "Write the contact email as an address, name@example.org",
  ),
});

/**
 * Reads the three fields off a submitted form. Absent inputs parse as empty,
 * so an editor screen that has not been given the fieldset yet simply leaves
 * the record's steward contact alone-looking — null — rather than failing.
 */
export function parseStewardContact(formData: FormData): StewardContactValues {
  return stewardContactSchema.parse({
    stewardName: formData.get("stewardName") ?? "",
    stewardPhone: formData.get("stewardPhone") ?? "",
    stewardEmail: formData.get("stewardEmail") ?? "",
  });
}

/**
 * The same three values as a patch for an `update … set`: an empty object when
 * the submitted form never carried the fieldset at all. A screen that edits a
 * record without showing its steward contact must not silently erase it, which
 * is what spreading three nulls would do.
 */
export function stewardContactPatch(
  formData: FormData,
): Partial<StewardContactValues> {
  const carried = STEWARD_FIELDS.some((field) => formData.has(field));
  return carried ? parseStewardContact(formData) : {};
}

/** True when there is anything to show — used to keep read views quiet. */
export function hasStewardContact(values: StewardContactValues) {
  return (
    values.stewardName !== null ||
    values.stewardPhone !== null ||
    values.stewardEmail !== null
  );
}
