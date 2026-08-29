/**
 * What the account has used today.
 *
 * A bare array, and **both metrics are always in it** — a missing entry means
 * "no such metric", never "zero used" (`B-039`). `resetsAt` is an absolute
 * instant rather than an hour: the day boundary is UTC, which is 03:00 in
 * Turkey, and the sentence around it is written in the user's own locale
 * (`F-007`).
 */

import { api } from '../client';
import type { Returns } from '../operations';

export type Usage = Returns<'usage', '*/*'>[number];

/** The metrics the server counts. Closed, and the client renders each by name. */
export type UsageMetric = 'generation' | 'profile_extract';

export function getUsage() {
  return api.get<Usage[]>('/account/usage');
}

/**
 * Deletes the account and everything under it (§ 57.4, `B-057`).
 *
 * **`204`, no body, and no confirmation field.** The endpoint sits behind the
 * session cookie and a CSRF token already; a "yes I am sure" flag in the body
 * would be a second lock on the same door and would put the decision in a
 * place the user never sees. The confirmation is a screen, and it is ours.
 *
 * **Idempotent.** Pressing it twice is not an error — a `204` either way —
 * which matters because the second press is what a dropped connection
 * produces.
 *
 * The response clears the session cookie, so the caller falls to **anonymous**
 * rather than to nothing: the next `GET /auth/session` stamps a fresh one.
 * That is why the screen afterwards is the home page and not a locked door.
 *
 * Two things survive deliberately, and the privacy policy has to say so:
 * cost history with the user link cut, and the suppression record for an
 * address that hard-bounced or complained — that belongs to the address, not
 * to the account, and removing it would let us mail somewhere we were told
 * not to.
 */
export function deleteAccount() {
  return api.delete<Returns<'delete_1'>>('/account');
}
