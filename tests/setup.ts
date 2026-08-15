import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { server } from '@/mocks/node';
import { resetProfileFixture } from '@/mocks/profileFixture';

expect.extend(toHaveNoViolations);

/**
 * jsdom implements no layout, so it ships no `ResizeObserver`. Radix reaches
 * for one in every primitive that measures itself — Slider is the first, and
 * it throws during the layout effect, which fails the whole render rather
 * than the one measurement.
 *
 * A stub is the right answer rather than a real polyfill: there are no boxes
 * to observe in jsdom, so a working implementation would report zero sizes
 * and be no more truthful than this. Anything that genuinely depends on
 * measured layout belongs in the Playwright suite, in a browser.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * The same handlers the browser worker uses. A behaviour asserted here is the
 * behaviour seen in development, which is the whole reason MSW was chosen
 * over a test-only fake.
 *
 * `error` rather than `warn` on an unhandled request: a request escaping to
 * the network in a unit test is a bug in the test, not background noise.
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  // The profile handlers keep state, because optimistic concurrency cannot be
  // mocked without it. Left alone, one test's writes would set the next
  // test's starting versions.
  resetProfileFixture();
  cleanup();
});

afterAll(() => server.close());
