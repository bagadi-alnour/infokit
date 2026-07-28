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
 * Somebody the record's own organisation already knows, offered as the contact
 * before the free-text fields. A membership record carries no phone number, so
 * choosing one of these fills a name and an address and no more.
 */
export interface StewardCandidate {
  id: string;
  name: string;
  email: string | null;
  /** Their role in the organisation, when one was recorded. */
  title: string | null;
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
