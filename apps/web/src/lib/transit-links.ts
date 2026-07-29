import { z } from "zod";

import { optionalTextUpTo } from "~/lib/form-fields";
import { type FormMessages } from "~/lib/form-messages";

/**
 * How someone arrives without a car: the bus, tram, metro, train, coach, ferry
 * or hire bike that reaches an activity or an event, the stop to get off at, and
 * how long the walk is from there.
 *
 * One module for both content types, because the question is the same one and
 * the answer has to be stored the same way — the forms build their rows from
 * this, and the actions read the post back through it, so what the editor filled
 * in and what the server writes cannot describe different journeys. It sits
 * outside the actions on purpose: a `use server` module may only export async
 * functions, so shared vocabulary has to live beside them.
 */

/** Matches the `transit_mode` enum; this order is the order a form offers. */
export const transitModes = [
  "bus",
  "tram",
  "metro",
  "train",
  "coach",
  "ferry",
  "bike",
  "other",
] as const;

export type TransitMode = (typeof transitModes)[number];

export const transitModeSchema = z.enum(transitModes);

/**
 * How many ways in one record may list. Six is more than anything in the
 * directory has needed, and few enough that a reader deciding how to get
 * somewhere reads the whole list instead of scanning it.
 */
export const MAX_TRANSIT_LINKS = 6;

/** The ceiling the two `walk_check` constraints hold, in minutes. */
export const MAX_WALK_MINUTES = 240;

/**
 * The keys one row posts under. Rows are repeated under the same four names and
 * read index-aligned, the same way opening hours travel — see
 * `~/lib/schedule-rules` and `parseTransitLinks` below.
 */
export const TRANSIT_FIELDS = {
  mode: "transitMode",
  line: "transitLine",
  stopName: "transitStop",
  walkMinutes: "transitWalk",
} as const;

/**
 * The marker a screen that edits transport links always posts, filled in or not.
 *
 * Rows cannot say "there are none of me": an editor who deletes the last row
 * posts nothing at all, which is indistinguishable from a screen that never
 * showed the fieldset. This hidden field is the difference, and it is what
 * `transitLinksPatch` reads before deciding to replace anything.
 */
export const TRANSIT_CARRIED_FIELD = "transitCarried";

/** One row as a form holds it: every value a string, as controls report them. */
export interface TransitLinkValues {
  mode: TransitMode;
  line: string;
  stopName: string;
  walkMinutes: string;
}

/** One row as the database keeps it, blanks already read as absent. */
export interface TransitLink {
  mode: TransitMode;
  line: string | null;
  stopName: string | null;
  walkMinutes: number | null;
}

/**
 * What an added row starts from. The bus is the default because in a city with
 * one network it is the answer most often, and a mode is never left unset — the
 * column is `not null`.
 */
export const EMPTY_TRANSIT_LINK: TransitLinkValues = {
  mode: "bus",
  line: "",
  stopName: "",
  walkMinutes: "",
};

/** Minutes as a form holds them: a small whole number, or nothing at all. */
const walkMinutesField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.coerce.number().int().min(0).max(MAX_WALK_MINUTES).nullable());

/**
 * One row's rules for the client, localized. Neither the line nor the stop is
 * required on its own — "bus 5" and "get off at Théâtre" are each useful — but a
 * row that names neither is nothing, and `transitRowsSchema` says so on the
 * field the editor can act on.
 */
export function transitRowSchema(messages: FormMessages) {
  return z.object({
    mode: transitModeSchema,
    line: z.string().trim().max(40, messages.tooLong),
    stopName: z.string().trim().max(120, messages.tooLong),
    walkMinutes: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^\d{1,3}$/.test(value),
        messages.invalid,
      )
      .refine(
        (value) => value === "" || Number(value) <= MAX_WALK_MINUTES,
        messages.invalid,
      ),
  });
}

/**
 * The whole list for a form, with the "say something" rule attached to the row
 * that breaks it. A row left completely empty is not an error — the editor added
 * it and changed their mind, and the save simply drops it.
 */
export function transitRowsSchema(messages: FormMessages, rowsKey: string) {
  return z
    .array(transitRowSchema(messages))
    .max(MAX_TRANSIT_LINKS)
    .superRefine((rows, context) => {
      for (const [index, row] of rows.entries()) {
        if (row.line !== "" || row.stopName !== "") continue;
        if (row.walkMinutes === "") continue;
        // Minutes on their own: a walk from nowhere named.
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [rowsKey, index, "stopName"],
          message: messages.required,
        });
      }
    });
}

/** True when the editor added a row and left it empty. */
export function isBlankTransitLink(row: TransitLinkValues) {
  return row.line.trim() === "" && row.stopName.trim() === "";
}

/** A stored row as a form holds it, for an edit screen's default values. */
export function transitLinkValues(link: TransitLink): TransitLinkValues {
  return {
    mode: link.mode,
    line: link.line ?? "",
    stopName: link.stopName ?? "",
    walkMinutes: link.walkMinutes === null ? "" : String(link.walkMinutes),
  };
}

const submittedLinkSchema = z.object({
  mode: transitModeSchema,
  line: optionalTextUpTo(40),
  stopName: optionalTextUpTo(120),
  walkMinutes: walkMinutesField,
});

/**
 * The rows a submitted form carries, in the order they were shown.
 *
 * Four repeated keys read index-aligned, so a row is whatever the fourth
 * `transitMode` and the fourth `transitLine` say together. Rows naming neither a
 * line nor a stop are dropped rather than rejected: that is an added row nobody
 * filled in, and it is the one mistake here that costs the editor nothing to
 * make. Anything else — an unknown mode, a walk of forty hours — fails the
 * parse, exactly as the form said it would before posting.
 *
 * A screen that does not carry the fieldset at all posts no keys and gets an
 * empty list; callers that must not erase what they never showed check
 * `formData.has` themselves, as `transitLinksPatch` does.
 */
export function parseTransitLinks(formData: FormData): TransitLink[] {
  const modes = formData.getAll(TRANSIT_FIELDS.mode);
  const lines = formData.getAll(TRANSIT_FIELDS.line);
  const stops = formData.getAll(TRANSIT_FIELDS.stopName);
  const walks = formData.getAll(TRANSIT_FIELDS.walkMinutes);

  const rows = modes
    .map((mode, index) => ({
      mode: text(mode),
      line: text(lines[index]),
      stopName: text(stops[index]),
      walkMinutes: text(walks[index]),
    }))
    .filter((row) => row.line !== "" || row.stopName !== "");

  return z.array(submittedLinkSchema).max(MAX_TRANSIT_LINKS).parse(rows);
}

/**
 * One posted value as text. `FormData` can also hand back a `File` — from a
 * tampered post, since no control here uploads anything — and a file has no
 * useful string form, so it reads as blank and the row is dropped or the mode
 * fails the enum, rather than being written as "[object File]".
 */
function text(value: FormDataEntryValue | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The same list, or `undefined` when the form never carried the fieldset — the
 * signal for "leave the stored rows alone". An editor screen that saves a record
 * without showing its transport links must not empty them, which is what an
 * unconditional replace would do.
 */
export function transitLinksPatch(
  formData: FormData,
): TransitLink[] | undefined {
  return formData.has(TRANSIT_CARRIED_FIELD)
    ? parseTransitLinks(formData)
    : undefined;
}
