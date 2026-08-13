import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
