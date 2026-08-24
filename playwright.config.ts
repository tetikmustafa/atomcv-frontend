import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Read by the warm-up, which runs outside the fixtures that know `baseURL`.
process.env.PLAYWRIGHT_BASE_URL = BASE_URL;

/**
 * Runs against `next dev`, not a production build.
 *
 * That is deliberate: MSW is disabled in production builds by design, so a
 * production server has no API at all until the backend exists. Once it does,
 * a second project can run the marketing pages against `next start`.
 *
 * A dedicated port keeps a running dev server on 3000 from being mistaken for
 * the one under test — a stale server answering probes has already produced
 * one wrong result in this project.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Compiles every route once before the workers start. Without it the first
  // request to each route pays for a `next dev` compile inside whichever test
  // drew it, and eight workers meeting eight cold routes lose eight tests to
  // work none of them was measuring.
  globalSetup: './tests/e2e/warmup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /**
   * Four locally, not "half the cores".
   *
   * The server under test is `next dev`, and what these tests wait on is
   * mostly it: a client-side navigation fetches an RSC payload, and eight
   * workers asking at once push that past a five-second assertion. The
   * failures looked like flaky tests and were a queue — measured at eight
   * (six to eight failures a run) and at four (three clean runs).
   *
   * Capping the askers is not the same as hiding a slow app: production
   * serves a build, and nothing here is waiting on the code under test.
   */
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEXT_PUBLIC_API_MOCKING: 'enabled' },
  },
});
