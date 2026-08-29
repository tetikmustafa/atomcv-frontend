/**
 * State behind the two sign-in endpoints, because both of them have some.
 *
 * These encode **behaviour**, not sample payloads — the same rule the
 * generation handlers follow. A `POST /auth/magic-link` that always answered
 * `202` would never show the screen its rate limit or its challenge refusal,
 * and both of those are things the screen has to do something about
 * (`B-050`): reset the widget, build a sentence out of `Retry-After`.
 */

/** § 40.5's address layer: three requests per fifteen minutes. */
const ADDRESS_LIMIT = 3;

/** What the mock puts in `Retry-After`, in seconds — one window. */
const RETRY_AFTER_SECONDS = 15 * 60;

export const auth = {
  /**
   * Requests seen per address, keyed by the **normalised** address.
   *
   * Normalisation is not tidiness: § 40.5.1 puts the address limiter behind
   * the same lowercasing the account lookup uses, because otherwise
   * `A@x.com` and `a@x.com` are two windows against one account and the limit
   * counts to six.
   */
  requests: new Map<string, number>(),

  /** Challenge tokens already spent. Turnstile's are single-use. */
  spentTokens: new Set<string>(),

  /** Selectors already redeemed. A sign-in link works exactly once (§ 40.2). */
  redeemed: new Set<string>(),

  /**
   * Off by default, which is the local deployment: with no Turnstile secret
   * the server lets a request through without a token (`B-050`). Turn it on
   * to describe production.
   */
  challengeRequired: false,

  /** What the next redemption reports about the anonymous profile (§ 41.3.3). */
  upgrade: 'none' as string,
};

export function resetAuthFixture() {
  auth.requests.clear();
  auth.spentTokens.clear();
  auth.redeemed.clear();
  auth.challengeRequired = false;
  auth.upgrade = 'none';
}

/** Production, where a missing or reused token is a `403`. */
export function requireChallenge() {
  auth.challengeRequired = true;
}

/** What the next `POST /auth/verify` says happened to the anonymous profile. */
export function nextUpgrade(value: string) {
  auth.upgrade = value;
}

/**
 * Rule 11 in a mock: an explicit locale, never the ambient one. Under `tr`,
 * `İSMAİL@x.com`.toLowerCase() keeps a dot on the i and the two windows the
 * normalisation exists to merge stay apart.
 */
export function normaliseAddress(email: string) {
  return email.trim().toLocaleLowerCase('en');
}

export function overAddressLimit(email: string) {
  const key = normaliseAddress(email);
  const seen = (auth.requests.get(key) ?? 0) + 1;
  auth.requests.set(key, seen);

  return seen > ADDRESS_LIMIT;
}

export function retryAfter() {
  return {
    seconds: RETRY_AFTER_SECONDS,
    resetsAt: new Date(Date.now() + RETRY_AFTER_SECONDS * 1000).toISOString(),
  };
}

/**
 * Whether the challenge refuses this request.
 *
 * Missing and already-spent are the same answer, which is the endpoint's own
 * rule: all four causes `B-050` lists lead to the same remedy, so telling
 * them apart would only invite a client to branch on something it must not.
 */
export function challengeRefused(token: string | undefined) {
  if (!auth.challengeRequired) return false;
  if (!token || auth.spentTokens.has(token)) return true;

  auth.spentTokens.add(token);
  return false;
}
