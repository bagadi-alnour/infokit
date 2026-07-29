import { headers } from "next/headers";

import { isPrefetchRequest } from "~/lib/prefetch-request";
import { recordAudit, type AuditInput } from "./record";

/**
 * The reads that are worth a row.
 *
 * Most reads are not: a visitor opening the public agenda, an editor listing
 * their own drafts, a browser fetching the image already on the page. Recording
 * those would cost more than it tells — the trail would fill with page views,
 * and the refusals worth finding would be buried under them.
 *
 * Some reads are the opposite. A read earns a row when at least one of these is
 * true, and the call site's comment says which:
 *
 *   1. It returns personal data in bulk — a roster with everybody's phone
 *      number is not the same event as opening one person's page.
 *   2. It reads the security trail itself, including looking up one individual
 *      in it. An audit log nobody audits is a log with a blind spot exactly
 *      where it matters.
 *   3. It hands out a private file, which leaves the platform once fetched.
 *   4. It was refused, and the caller had identified themselves first. An
 *      anonymous 404 is the internet; an authenticated one is somebody who is
 *      already inside trying a door that is not theirs.
 *
 * The row says who read, not what they read: `subject_label` names the list or
 * the file, and `metadata` counts the rows disclosed. A trail that copied out
 * the contact details it was describing would be the same leak twice.
 */

/**
 * A read is `success` or `denied` — there is no half-served list, and a query
 * that threw is a bug for the error log rather than an access event. `changes`
 * is absent for the same reason: nothing changed.
 */
export type RestrictedReadInput = Omit<AuditInput, "changes" | "durationMs">;

/**
 * A prefetched render is not somebody reading. `~/lib/prefetch-request` owns the
 * predicate, and is tested; this only gets the headers to give it.
 */
async function isRouterPrefetch(): Promise<boolean> {
  try {
    return isPrefetchRequest(await headers());
  } catch {
    // No request to read: a script or a job, which is nobody's prefetch.
    return false;
  }
}

/**
 * Record a read that the four rules above cover. Everything else about the row
 * — the actor, the address, the route, the browser — comes from `recordAudit`,
 * so a read event and a write event are the same kind of evidence.
 */
export async function recordRestrictedRead(
  input: RestrictedReadInput,
): Promise<void> {
  if (await isRouterPrefetch()) return;
  await recordAudit(input);
}
