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
import type { Accepts, Returns } from '../operations';

export type Usage = Returns<'accountUsage', '*/*'>[number];

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
 * **Idempotent, but the second press does not reach it.** A `204` either way
 * was measured wrong (`F-027`): the first response clears the cookie, and a
 * session pointing at an account that no longer exists is no session at all,
 * so a repeat answers `401 AUTHENTICATION_REQUIRED`. The `204` we had seen
 * came from the local dev auth stub, which identified the caller without one.
 * That is the answer a dropped connection now produces, and it is the right
 * one: the work was done.
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
  return api.delete<Returns<'deleteAccount'>>('/account');
}

/* ---------------------------- account settings --------------------------- */

/**
 * What the account itself is set to, as opposed to what the profile is
 * (§ 57.7). One field today: whether the optional emails go out.
 *
 * **Not on `PUT /profile/preferences`**, and the reason is worth keeping.
 * That endpoint *replaces* the preferences and is guarded by the profile's
 * own `ETag`, so a version conflict about a CV would refuse a change about an
 * email — and a body that left the field out would be turning it off. The
 * preference belongs to the account, which is also what has an address.
 */
export type AccountSettings = Returns<'accountSettings', '*/*'>;

export type AccountSettingsUpdate = Accepts<'updateAccountSettings'>;

export function getAccountSettings() {
  return api.get<AccountSettings>('/account');
}

/**
 * Writes it and answers with the value as it now stands, which is what the
 * screen shows: the switch reflects the server rather than the press.
 */
export function updateAccountSettings(body: AccountSettingsUpdate) {
  return api.patch<AccountSettings>('/account', body as Record<string, unknown>);
}

/* ------------------------------- unsubscribe ----------------------------- */

/**
 * Turns the optional emails off for whoever the token belongs to (§ 57.7).
 *
 * **No session**, because it is pressed from an inbox where there may be no
 * cookie. CSRF still applies in the ordinary way: the page is on our origin
 * and can read the token to double-submit it.
 *
 * **An unknown token answers 204 too**, deliberately — a different answer
 * would be an oracle for which tokens are live. So there is no "invalid
 * link" state to render, and the page says the same thing either way.
 */
export type UnsubscribeRequest = Accepts<'unsubscribe'>;

export function unsubscribe(token: string) {
  return api.post<Returns<'unsubscribe'>>('/email/unsubscribe', {
    token,
  } satisfies UnsubscribeRequest);
}
