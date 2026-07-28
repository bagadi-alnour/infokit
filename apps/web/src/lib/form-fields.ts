import { z } from "zod";

/**
 * Field readers for `FormData`, where every value arrives as a string and an
 * untouched input arrives as `""`.
 *
 * These read `""` as "not given" rather than as a value, so an action never has
 * to decide whether an empty string meant empty or absent — the column gets
 * `null` and stays honest about it. Anything else is still validated: a typo'd
 * id or a non-numeric latitude fails the parse rather than quietly becoming
 * `null`, because silently dropping a field the editor did fill in loses their
 * work without telling them.
 */

const blankToNull = (value: string) => (value === "" ? null : value);

/** Trimmed text, or `null` when the field was left blank. */
export const optionalText = z.string().trim().transform(blankToNull);

/** As `optionalText`, with a length ceiling the database column can hold. */
export const optionalTextUpTo = (max: number) =>
  z.string().trim().max(max).transform(blankToNull);

/**
 * An id chosen from a `<select>`, or `null` for its "none" option. A value that
 * is neither is rejected: it can only come from a tampered or stale form.
 */
export const optionalUuid = z
  .string()
  .trim()
  .transform(blankToNull)
  .pipe(z.string().uuid().nullable());

/** A number typed into a text input, or `null` when left blank. */
export const optionalNumber = z
  .string()
  .trim()
  .transform(blankToNull)
  .pipe(z.coerce.number().finite().nullable());
