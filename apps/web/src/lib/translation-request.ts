/**
 * Where an outstanding translator request stands, on both sides of the wire.
 *
 * The lifecycle lives on the server (`~/server/content/translation-assignments`);
 * what is here is the one question every screen asks of it — is this language in
 * somebody's hands right now — so a server page and a browser menu can answer it
 * the same way without either importing the other.
 */

/**
 * The states a sent request is still live in: the link opens, and whatever the
 * translator does next lands on this assignment.
 *
 * `reviewed`, `accepted` and `published` are past that point — the words have
 * arrived and an editor has acted on them — and `expired`, `rejected` and a
 * revoked link are over. None of those are an errand anybody is waiting on.
 */
const liveStates = ["requested", "draft", "submitted"];

/** A language already sent out, whose translator has not been answered yet. */
export function translationRequestLive(
  assignment: { state: string } | null | undefined,
): boolean {
  return assignment ? liveStates.includes(assignment.state) : false;
}
