/**
 * Compiles every route the suite visits, once, before any test runs.
 *
 * `next dev` builds a route the first time it is asked for, and this suite
 * runs against `next dev` because MSW is disabled in production builds by
 * design. Playwright's `webServer` waits for the server to answer, not for
 * the routes to exist, so with eight workers the first eight requests all
 * pay for a different compile at the same time — and the slowest of them
 * loses a thirty-second test to work that has nothing to do with the test.
 *
 * That failed as a flake first and as eight simultaneous flakes once the
 * generation routes arrived. Warming them here fixes the cause rather than
 * the symptom: no per-test timeout to raise, no worker count to lower, and
 * the parallelism the suite is worth keeping.
 */

const ROUTES = [
  '/en',
  '/en/profile',
  '/en/generate',
  // Any id will do — what is being compiled is the route, not the page.
  '/en/generations/warmup',
  '/en/onboarding',
  '/en/onboarding/review',
  '/en/dev/mocks',
  '/en/login',
  '/en/auth/complete',
  '/en/auth/error',
  '/en/verify',
  '/en/legal/privacy',
  '/en/legal/terms',
  '/tr',
];

export default async function warmup() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';

  // Sequential on purpose: the point is to *not* ask for eight compiles at
  // once, which is the thing this exists to prevent.
  for (const route of ROUTES) {
    const response = await fetch(`${baseUrl}${route}`, { headers: { Accept: 'text/html' } });

    // A route that cannot be compiled is a broken build, and finding out here
    // beats finding out as an unexplained timeout in whichever test drew it.
    if (!response.ok) {
      throw new Error(`Warm-up failed for ${route}: ${response.status}`);
    }

    await response.text();
  }
}
