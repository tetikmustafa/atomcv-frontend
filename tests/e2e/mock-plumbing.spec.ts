import { expect, test } from '@playwright/test';

/**
 * Answers the verification left open since the mocking strategy was chosen:
 * MSW streams `text/event-stream` correctly under Node, but nothing had shown
 * that its **service worker** can feed a browser `EventSource` — which is the
 * API Bölüm 36.4 specifies for progress.
 *
 * These run against the development harness, the only route where the shell,
 * the providers, the worker and the client all mount together.
 */
test.describe('mock plumbing', () => {
  test('the service worker answers API calls in the browser', async ({ page }) => {
    await page.goto('/en/dev/mocks');

    await expect(page.getByTestId('authenticated')).toHaveText('false');
    await expect(page.getByTestId('allowed-languages')).toHaveText('en');
    await expect(page.getByTestId('max-atoms')).toHaveText('60');
  });

  test('EventSource receives streamed phases and a terminal event', async ({ page }) => {
    await page.goto('/en/dev/mocks');
    await page.getByTestId('start-job').click();

    // Incremental delivery is the property under test, and asserting an exact
    // count at an exact instant races the stream. Ordering is the reliable
    // form of the same claim: if the response were buffered, every phase and
    // the terminal event would land in one tick, so no phase could be visible
    // while `completed` is still absent.
    await expect(page.getByTestId('phase').first()).toBeVisible();
    await expect(page.getByTestId('phase').first()).toContainText('Analysing the posting');
    await expect(page.getByTestId('completed')).toHaveCount(0);

    await expect(page.getByTestId('completed')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('phase')).toHaveCount(6);
    await expect(page.getByTestId('completed')).toContainText('gen-1');
  });

  test('progress is announced, not just drawn', async ({ page }) => {
    await page.goto('/en/dev/mocks');
    await page.getByTestId('start-job').click();

    // Rule 6: a moving bar is invisible to a screen reader. The live region
    // is the only thing carrying progress to it.
    const liveRegion = page.getByRole('status');
    await expect(liveRegion).toContainText('percent');

    await expect(page.getByTestId('completed')).toBeVisible({ timeout: 15_000 });
    await expect(liveRegion).toHaveText('Generation complete');
  });
});
