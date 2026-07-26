/**
 * The languages an agenda event can be authored in — the three interface
 * languages, because an event is read in the console and on the public agenda,
 * both of which only exist in these.
 *
 * This lives outside the server actions on purpose: a `"use server"` module may
 * only export async functions, so shared vocabulary has to sit beside them.
 */
export const eventLanguages = ["fr", "en", "ar"] as const;

export type EventLanguage = (typeof eventLanguages)[number];
