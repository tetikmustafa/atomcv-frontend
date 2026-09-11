import { http, HttpResponse } from 'msw';
import type { MagicLinkRequest, Session, VerifyRequest } from '@/lib/api/endpoints/auth';
import { applicationHandlers } from './applicationHandlers';
import { auth, challengeRefused, overAddressLimit, retryAfter } from './authFixture';
import { generationHandlers } from './generationHandlers';
import { importHandlers } from './importHandlers';
import { problem } from './problem';
import { profileHandlers } from './profileHandlers';
import { resetProfileFixture } from './profileFixture';
import {
  currentSession,
  isAccount,
  lifecycleEmails,
  setLifecycleEmails,
  signIn,
  signOut,
  UNSUBSCRIBE_TOKEN,
} from './sessionFixture';

/**
 * Mock API surface. One set of handlers, shared by the browser worker, Vitest
 * and Playwright — so a behaviour verified in a test is the same one seen in
 * the browser.
 *
 * These encode *behaviour*, not sample payloads. The point is to exercise the
 * paths that are easy to get wrong: capability-gated UI, a preflight error
 * that arrives with resolutions, and a job whose progress streams in.
 *
 * Paths use a `*` origin prefix so the same handler matches a relative request
 * in the browser and an absolute one under Node.
 *
 * Only the session surface lives here. The profile and generation surfaces
 * keep state, and each has its own file for it; the two capability sets are
 * in `sessionFixture.ts` for the same reason.
 */
export const handlers = [
  ...profileHandlers,

  /**
   * Anonymous by default — § 9's narrower scope, never lower quality. The UI
   * gates itself on what this returns rather than on assumptions about what
   * anonymous users can do.
   */
  http.get('*/api/v1/auth/session', () =>
    HttpResponse.json<Session>(currentSession(), {
      // The header the real endpoint sends (`B-046`). It changes nothing in
      // MSW, which never consults a cache — it is here so the mock does not
      // quietly describe a more cacheable endpoint than the one it stands in
      // for.
      headers: { 'Cache-Control': 'no-store' },
    }),
  ),

  /**
   * `204` whether or not there was a session to end (`B-046`). Idempotent by
   * design: signing out twice is not an error, and the second press of a
   * button on a slow connection is the ordinary way it happens.
   */
  http.post('*/api/v1/auth/logout', () => {
    signOut();
    return new HttpResponse(null, { status: 204 });
  }),

  /**
   * What a fully configured deployment offers (§ 40.6.1). Two, because the
   * screen has to survive more than one — a list rendered as "the first one"
   * looks right until the day it is wrong.
   *
   * **The hop itself is not mocked, and cannot be.** `/auth/oauth/{p}/start`
   * answers `302` to Google, and the button that reaches it is a top-level
   * navigation — which the MSW worker bypasses by design (`request.mode ===
   * 'navigate'`). Standing in for it would mean inventing a fake provider
   * screen, so the seam is drawn where it is real: the button's `href` is
   * asserted, and `/auth/complete` is exercised by going there directly, the
   * same way the browser arrives.
   */
  http.get('*/api/v1/auth/providers', () => HttpResponse.json(['google', 'github'])),

  /**
   * The account's own settings (§ 57.7, `B-096`).
   *
   * On `/account` rather than on `PUT /profile/preferences`, and the reason
   * is behavioural: that endpoint replaces the preferences and is guarded by
   * the profile's `ETag`, so a version conflict about a CV would refuse a
   * change about an email — and leaving the field out of a replace would be
   * turning it off.
   *
   * `PATCH` answers with the value **as it now stands**, which is what the
   * switch shows: a control that reported the click rather than the server
   * would go on looking right after a refusal.
   */
  http.get('*/api/v1/account', () => {
    if (!isAccount()) {
      return HttpResponse.json(problem(401, 'AUTHENTICATION_REQUIRED', '/api/v1/account'), {
        status: 401,
      });
    }

    return HttpResponse.json({ lifecycleEmails: lifecycleEmails() });
  }),

  http.patch('*/api/v1/account', async ({ request }) => {
    if (!isAccount()) {
      return HttpResponse.json(problem(401, 'AUTHENTICATION_REQUIRED', '/api/v1/account'), {
        status: 401,
      });
    }

    const body = (await request.json()) as { lifecycleEmails?: boolean };
    if (body.lifecycleEmails !== undefined) setLifecycleEmails(body.lifecycleEmails);

    return HttpResponse.json({ lifecycleEmails: lifecycleEmails() });
  }),

  /**
   * Turning the optional emails off from an inbox (§ 57.7, § 40.3).
   *
   * **No session**, and **204 for a token nobody has ever heard of.** A
   * different answer would be an oracle for which tokens are live, so there
   * is deliberately no "invalid link" state for a page to render — which is
   * also why the mock cannot be asked to produce one.
   */
  http.post('*/api/v1/email/unsubscribe', async ({ request }) => {
    const body = (await request.json()) as { token?: string };

    // The one refusal there is: a body with no token at all is malformed
    // rather than unknown.
    if (!body.token) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', '/api/v1/email/unsubscribe', [], { fields: ['token'] }),
        { status: 400 },
      );
    }

    // A live token turns the preference off; any other token changes nothing
    // and says the same thing.
    if (body.token === UNSUBSCRIBE_TOKEN) setLifecycleEmails(false);

    return new HttpResponse(null, { status: 204 });
  }),

  /**
   * Deleting the account (§ 57.4, `B-057`).
   *
   * **`204` once, then `401` — and the second half was measured** (`F-027`).
   * The gate is the caller: an anonymous one has no account, and the endpoint
   * says so rather than pretending to have deleted something. A second press
   * meets the same gate, because the first response signed this caller out.
   *
   * That used to be an accident of `signOut()` here while the comment claimed
   * `204` either way. The wire settled it: a session pointing at a deleted
   * account is no session, so the repeat a dropped connection produces gets
   * `401` too. The old `204` came from the local dev auth stub.
   *
   * The screen never reaches the anonymous branch, because it gates on the
   * session — the handler encodes it so a screen that stopped gating would be
   * caught here rather than by nothing.
   */
  http.delete('*/api/v1/account', () => {
    if (!isAccount()) {
      return HttpResponse.json(problem(401, 'AUTHENTICATION_REQUIRED', '/api/v1/account'), {
        status: 401,
      });
    }

    // The rows go, and so does the cookie — which is what leaves the caller
    // anonymous rather than with nothing.
    resetProfileFixture();
    signOut();

    return new HttpResponse(null, { status: 204 });
  }),

  /**
   * `202`, empty, and the same for an address with an account and one
   * without (§ 40.4.1). There is deliberately nothing here that could branch
   * on whether the address is known — a mock that did would let a screen be
   * written against a distinction the real endpoint refuses to make.
   *
   * The two refusals are real behaviour rather than fixtures: the challenge
   * is off unless a test asks for production, and the address limiter counts
   * to three the way § 40.5 does.
   */
  http.post('*/api/v1/auth/magic-link', async ({ request }) => {
    const body = (await request.json()) as MagicLinkRequest;
    const instance = '/api/v1/auth/magic-link';

    if (challengeRefused(body.challengeToken)) {
      return HttpResponse.json(problem(403, 'CHALLENGE_FAILED', instance), { status: 403 });
    }

    if (overAddressLimit(body.email)) {
      const { seconds, resetsAt } = retryAfter();

      return HttpResponse.json(problem(429, 'RATE_LIMITED', instance, [], { resetsAt }), {
        status: 429,
        // The header the sentence is actually built from (`B-050`). It is
        // the whole reason this handler exists: MSW is the only place the
        // client ever sees one before the backend is running.
        headers: { 'Retry-After': String(seconds) },
      });
    }

    return new HttpResponse(null, { status: 202 });
  }),

  /**
   * `200` with § 41.3.3's outcome — not the `204` the first draft promised
   * (`B-054`).
   *
   * Single-use, and that is the behaviour worth having: redeeming the same
   * selector twice is the ordinary way `MAGIC_LINK_INVALID` happens, and it
   * is also what a mail scanner would cause if the page verified on `GET`.
   */
  http.post('*/api/v1/auth/verify', async ({ request }) => {
    const { selector } = (await request.json()) as VerifyRequest;

    if (!selector || auth.redeemed.has(selector)) {
      return HttpResponse.json(problem(400, 'MAGIC_LINK_INVALID', '/api/v1/auth/verify'), {
        status: 400,
      });
    }

    auth.redeemed.add(selector);
    signIn();

    return HttpResponse.json({ profileUpgrade: auth.upgrade });
  }),

  ...importHandlers,
  ...generationHandlers,
  ...applicationHandlers,
];
