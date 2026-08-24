import { expect, test, type Page } from '@playwright/test';

/**
 * The generation flow, end to end, through the browser's own `EventSource`
 * and MSW's service worker.
 *
 * These walk in through the front door on purpose. Stage 1's suite reached
 * the editor by typing its URL every time, so nothing noticed that no link
 * led there — a route reachable only by bookmark is not reachable.
 */

/** A posting with two distinct signal words and enough of them (§ 18.1). */
const REAL_POSTING = [
  'We are seeking a senior backend engineer to join a small platform team.',
  'Responsibilities: designing services, operating them in production, and',
  'mentoring the engineers around you. Requirements: several years of Java,',
  'PostgreSQL, container orchestration and a habit of writing things down.',
  'Preferred qualifications include message queues and infrastructure as code.',
].join(' ');

/**
 * In through the front door.
 *
 * The generous timeout this used to carry is gone: the cold-compile flake it
 * worked around is fixed at the source, in `globalSetup`, which compiles every
 * route before the workers start.
 */
async function openGenerate(page: Page) {
  await page.goto('/en/profile');
  await page.getByRole('link', { name: 'Generate', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/generate$/);
  await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeVisible();
}

test.describe('generating a resume', () => {
  test('is reachable from the editor, and marks where you are', async ({ page }) => {
    await openGenerate(page);

    await expect(page.getByRole('link', { name: 'Generate', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('runs a posting through to a downloadable result', async ({ page }) => {
    await openGenerate(page);

    await page.getByLabel('Job posting').fill(REAL_POSTING);
    await page.getByRole('button', { name: 'Generate', exact: true }).click();

    // The bar and its caption, before anything has finished. Ordering rather
    // than a count at an instant: asserting the exact phase races the stream.
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByTestId('phase-caption')).toBeVisible();

    // Rule 6: the bar is invisible to a screen reader, and here it is the
    // only sign the application is doing anything.
    await expect(page.getByRole('status')).toContainText('percent');

    await expect(page).toHaveURL(/\/en\/generations\/gen-1$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
    // The page count rides the stream, so a result watched from the start
    // has it.
    await expect(page.getByText('One page.')).toBeVisible();
  });

  test('ends on countable facts, never a percentage', async ({ page }) => {
    await openGenerate(page);

    await page.getByLabel('Job posting').fill(REAL_POSTING);
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/generations\/gen-1$/, { timeout: 15_000 });

    const report = page.getByRole('region', { name: /matches the posting/i });
    await expect(report.getByTestId('fit-required')).toHaveText('3/4');
    await expect(report.getByTestId('fit-preferred')).toHaveText('2/3');

    // Bolum 23.3 forbids one by name. Completeness is the opposite — a
    // percentage by design — and the two must not be unified.
    await expect(report).not.toContainText('%');

    // The reload path is not asserted here: MSW's state lives in the page, so
    // a reload throws away the generation the mock made and answers 404. It
    // is verified against the real backend in the closing round, where the
    // resource genuinely persists.
  });

  test('says there was nothing to compare against in general mode', async ({ page }) => {
    await openGenerate(page);
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/generations\/gen-1$/, { timeout: 15_000 });

    await expect(page.getByText('nothing to measure this against')).toBeVisible();
    await expect(page.getByTestId('fit-required')).toHaveCount(0);
  });

  test('counts the allowance down as it is spent', async ({ page }) => {
    await openGenerate(page);

    // Before the request, not after the refusal: a limit a user only meets by
    // hitting it is a limit they experience as a failure (§ 44).
    await expect(page.getByTestId('usage-count')).toHaveText('0 of 5');

    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/generations\/gen-1$/, { timeout: 15_000 });

    await page.goBack();
    // Charged on enqueue, so the number moved while the job was still running.
    await expect(page.getByTestId('usage-count')).toHaveText('1 of 5');
  });

  test('asks rather than blocks when the text does not read as a posting', async ({ page }) => {
    await openGenerate(page);

    await page.getByLabel('Job posting').fill('hire someone good');
    await page.getByRole('button', { name: 'Generate', exact: true }).click();

    // § 18.1's three ways out, in its order. Insisting comes first because it
    // is the only one that does not throw the user's text away.
    //
    // Scoped to `main`: the announcer's assertive region is a `role="alert"`
    // too, and it is always in the document. An unscoped query matches it
    // first and finds a panel with no buttons in it — which is how a check
    // written this way passed while proving nothing.
    const panel = page.getByRole('main').getByRole('alert');
    await expect(panel.getByRole('button')).toHaveText([
      'Continue anyway',
      'Paste the full posting',
      'Build a general resume instead',
    ]);

    await panel.getByRole('button', { name: 'Continue anyway' }).click();

    // Not a retry: the same text goes again with the preflight acknowledged,
    // and this time it is accepted.
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/generations\/gen-1$/, { timeout: 15_000 });
  });

  test('builds a general resume when no posting is given', async ({ page }) => {
    await openGenerate(page);

    // Never disabled for an empty field: the absence of a posting is general
    // mode, which is narrower in aim and not lower in quality.
    await page.getByRole('button', { name: 'Generate', exact: true }).click();

    await expect(page).toHaveURL(/\/en\/generations\/gen-1$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  });

  test('hands over a file the browser saves', async ({ page }) => {
    await openGenerate(page);
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/generations\/gen-1$/, { timeout: 15_000 });

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF' }).click();

    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  });
});
