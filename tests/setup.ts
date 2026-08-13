import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { server } from '@/mocks/node';

expect.extend(toHaveNoViolations);

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
  cleanup();
});

afterAll(() => server.close());
