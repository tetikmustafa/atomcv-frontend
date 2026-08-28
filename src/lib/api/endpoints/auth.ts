/**
 * Who is here, and what they may do (§ 35.7).
 *
 * The whole surface is Stage 3; this file starts with the one call that
 * already had a caller. `/auth/logout`, the OAuth routes and the magic link
 * land with the screens that use them.
 */

import { api } from '../client';
import type { Returns } from '../operations';

type RawSession = Returns<'session', '*/*'>;
type RawCapabilities = NonNullable<RawSession['capabilities']>;

/**
 * The three fields that genuinely vary, kept optional; everything else is
 * required.
 *
 * springdoc marks nothing required, but § 35.7 publishes a full table for
 * both session kinds: the four flags, both quotas and both counters are
 * always there. Requiring them is what lets a capability gate be a plain
 * boolean read rather than a three-way one, where `undefined` would silently
 * take the "cannot" branch and hide a feature the user has.
 *
 * The three left optional are the ones that really do come and go, and
 * `B-046` is explicit that in an account they are **absent from the JSON**
 * rather than `null` — the schema says nullable, so both readings have to
 * survive. A progress bar drawn against a limit that is not there is a wrong
 * screen, not a cosmetic one.
 */
type Varying = 'maxAtoms' | 'quotaResetsAt' | 'anonymousExpiresAt';

export type Capabilities = Required<Omit<RawCapabilities, Varying>> &
  Pick<RawCapabilities, Varying>;

export type Session = Required<Omit<RawSession, 'capabilities'>> & {
  capabilities: Capabilities;
};

/**
 * The current session, anonymous or not.
 *
 * Answered `no-store`, and that is not incidental: `anonymousExpiresAt`
 * slides with activity (§ 35.7), so a warning drawn from a cached copy counts
 * down to the wrong moment. Whatever caches this must re-read it rather than
 * serve what it has.
 */
export function getSession() {
  return api.get<Session>('/auth/session');
}

/**
 * Ends the session server-side.
 *
 * Answers `204` whether or not there was one to end, so there is no "were you
 * even signed in" branch to write. The cookie is cleared by the response, not
 * by us — rule 10 holds here too.
 *
 * What comes back is an **anonymous** session, not nothing: § 35.7's endpoint
 * stamps one for a caller that arrives without a cookie. So the screen after
 * signing out is the anonymous product, not a locked door.
 */
export function logout() {
  return api.post<void>('/auth/logout');
}
