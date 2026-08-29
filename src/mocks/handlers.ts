import { http, HttpResponse } from 'msw';
import type { MagicLinkRequest, Session, VerifyRequest } from '@/lib/api/endpoints/auth';
import { auth, challengeRefused, overAddressLimit, retryAfter } from './authFixture';
import { generationHandlers } from './generationHandlers';
import { problem } from './problem';
import { profileHandlers } from './profileHandlers';
import { currentSession, signIn, signOut } from './sessionFixture';

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

  ...generationHandlers,
];
