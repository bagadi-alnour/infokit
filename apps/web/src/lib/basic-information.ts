/**
 * The vocabulary of a basic-information tile, on both sides of the wire.
 *
 * The rules live in the server action (`app/[locale]/dashboard/basics/actions`);
 * what is here is only the shape of the words, because the form that offers an
 * editor "this number is texted, not called" has to name the same values the
 * action validates. It sits outside the action for the ordinary reason: a
 * `"use server"` module may export nothing but async functions.
 */

/**
 * How a tile is reached — mirrors `content.basic_information_reach`.
 *
 * Repeated here rather than imported from the drizzle enum: this module is read
 * by the browser bundle, and the schema pulls in the whole database layer. The
 * action feeds these straight into the insert, so a value that stopped being
 * part of the enum fails to compile there.
 */
export const basicInformationReaches = ["voice", "sms", "whatsapp"] as const;
export type BasicInformationReach = (typeof basicInformationReaches)[number];

/**
 * The scheme a reach opens with. `sms:` for a number that is written to — 114
 * is texted and never answered by voice — so a surface can never offer a call
 * that cannot connect.
 *
 * WhatsApp dials as an ordinary call as well: the app is an *additional* route
 * on the same number, useful on a data-only phone, and `wa.me` is a redirect
 * through a third party that a public page should not make a reader depend on.
 */
export function reachHref(reach: BasicInformationReach, dial: string): string {
  // Spaces are for reading, not for dialling.
  const digits = dial.replace(/\s/g, "");
  return `${reach === "sms" ? "sms" : "tel"}:${digits}`;
}

/** True where the same number is also reachable in WhatsApp. */
export function reachableOnWhatsApp(reach: BasicInformationReach): boolean {
  return reach === "whatsapp";
}

/**
 * How long a tile may go unchecked before the workspace asks about it again.
 *
 * Shorter than an article's default, and deliberately so. A volunteer help line
 * moves when the association reorganises and nobody sends a notice; a quarter
 * is the longest a number can sit unverified before "we published this" stops
 * meaning "this still answers". The state's own numbers are the exception the
 * long option exists for — 112 is 112 until France changes it.
 */
export const BASIC_INFORMATION_REVIEW_DAYS = 90;

/** The intervals the form offers, in days. */
export const basicInformationReviewIntervals = [30, 90, 180, 365] as const;
