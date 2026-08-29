/**
 * Who is here, and what they may do (§ 35.7).
 *
 * The whole surface is Stage 3, and it lands with the screens that use it.
 * The magic link is the part still missing here.
 */

import { API_BASE_URL, api } from '../client';
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
 * What became of the anonymous profile when this person signed in (§ 41.3.3).
 *
 * A one-off fact rather than a property of the session: the client reads it,
 * says something or says nothing, and it is over. Carried in the sign-in
 * response, and — because an OAuth sign-in has no response the client can
 * read — repeated in the landing URL's `profile` parameter (`B-054`).
 *
 * Four values, and they are not two: "there was nothing to carry over" needs
 * no sentence at all, "your account already had a profile" is an absence the
 * person would otherwise discover on their own, and "we could not read it" is
 * neither of those. Telling somebody who uploaded a CV ten minutes ago that
 * there was nothing to move would be the product lying about its own outage.
 */
export type ProfileUpgrade = NonNullable<Returns<'verify', '*/*'>['profileUpgrade']>;

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

/**
 * Which providers this deployment can sign people in with.
 *
 * A list of ids, and it is the deployment's answer rather than the product's:
 * a provider whose credentials are not configured is **absent** rather than
 * present-and-broken (§ 40.6.1). So the screen renders the buttons this names
 * and no others — a hardcoded pair would offer a way in that answers 404 on
 * one deployment and works on the next.
 */
export function getProviders() {
  return api.get<Returns<'providers', '*/*'>>('/auth/providers');
}

/**
 * Where the "continue with …" button points.
 *
 * A URL rather than a call, and it has to be: this endpoint answers `302` to
 * the provider, on the provider's own origin, where the person then reads a
 * consent screen and types a password. That has to happen as a **top-level
 * navigation** — `fetch` would follow the redirect opaquely and hand back
 * nothing, and even if it did not, a consent screen the address bar does not
 * vouch for is one nobody should type into.
 *
 * `next` travels **without** a locale prefix. The landing page adds one
 * through next-intl's router, so the language is decided in the same place it
 * is decided everywhere else; `safeReturnPath` drops one that arrives anyway.
 */
export function oauthStartUrl(provider: string, next: string) {
  const query = new URLSearchParams({ next });

  return `${API_BASE_URL}/auth/oauth/${encodeURIComponent(provider)}/start?${query}`;
}
