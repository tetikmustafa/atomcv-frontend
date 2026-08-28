import { http, HttpResponse } from 'msw';
import type { Session } from '@/lib/api/endpoints/auth';
import { generationHandlers } from './generationHandlers';
import { profileHandlers } from './profileHandlers';
import { currentSession, signOut } from './sessionFixture';

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

  ...generationHandlers,
];
