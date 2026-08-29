import { expect, test } from '@playwright/test';
import { asAccount } from './support/session';

/**
 * The history, in a real browser (`B-066`).
 *
 * What only this suite can prove: that a resume made through the front door
 * turns up in the list afterwards. The mock keeps its jobs in the page, so
 * generating and listing have to happen in one visit — which is also the
 * journey a person actually makes.
 */

/** A posting with two distinct signal words and enough of them (§ 18.1). */
const REAL_POSTING = [
  'We are seeking a senior backend engineer to join a small platform team.',
  'Responsibilities: designing services, operating them in production, and',
  'mentoring the engineers around you. Requirements: several years of Java,',
  'PostgreSQL, container orchestration and a habit of writing things down.',
  'Preferred qualifications include message queues and infrastructure as code.',
].join(' ');

test.describe('the history', () => {
  test('is reachable from the nav, and marks where you are', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/profile');

    await page.getByRole('link', { name: 'Your resumes' }).click();

    await expect(page).toHaveURL('/en/history');
    await expect(page.getByRole('link', { name: 'Your resumes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('lists a resume once one has been made', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/generate');

    await page.getByLabel('Job posting').fill(REAL_POSTING);
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/generations\/gen-1$/, { timeout: 15_000 });

    await page.getByRole('link', { name: 'Your resumes' }).click();

    const rows = page.getByRole('listitem');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByRole('link')).toHaveAttribute('href', '/en/generations/gen-1');
  });

  /**
   * § 33.4: anonymous mode is narrower, never broken. The sentence says what
   * is different rather than presenting a locked door — and nothing is asked
   * for, because there is nothing to ask.
   */
  test('tells an anonymous visitor what they get instead', async ({ page }) => {
    await page.goto('/en/history');

    await expect(page.getByText(/only listed here for accounts/)).toBeVisible();
    await expect(page.locator('main').getByRole('list')).toHaveCount(0);
  });
});
