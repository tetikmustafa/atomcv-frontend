import { expect, test } from '@playwright/test';
import { asAccount, seedSession } from './support/session';

/**
 * The application tracker and the unsubscribe page, in a real browser
 * (`B-093`, `B-096`).
 *
 * What only this suite can prove: that both routes are **reachable** — one
 * from the nav, one from an address somebody pastes out of an email — and
 * that the second does nothing until it is pressed. A route reachable only by
 * bookmark is not reachable, which is the thing the nav was written to fix
 * for the editor.
 */

test.describe('the application tracker', () => {
  test('is reachable from the nav, and marks where you are', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/profile');

    await page.getByRole('link', { name: 'Applications' }).click();

    await expect(page).toHaveURL('/en/applications');
    await expect(page.getByRole('link', { name: 'Applications' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('records one and moves it between states', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/applications');

    await page.getByLabel('Company').fill('Acme');
    await page.getByLabel('Position').fill('Backend Engineer');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('Backend Engineer')).toBeVisible();

    // Every transition is allowed, including ones that reopen a closed
    // process — so the control offers them all.
    await page.getByLabel('Status').selectOption('offer');
    await expect(page.getByLabel('Status')).toHaveValue('offer');

    await page.getByRole('button', { name: 'Forget this' }).click();
    await expect(page.getByText('Nothing here yet.')).toBeVisible();
  });

  test('says why it needs an account rather than asking and being refused', async ({ page }) => {
    await seedSession(page, 'anonymous');
    await page.goto('/en/applications');

    await expect(page.getByText(/needs an account/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toHaveCount(0);
  });
});

test.describe('the unsubscribe page', () => {
  /**
   * § 40.3's trap, and the reason the link lands on a page at all: a mail
   * gateway that fetches the address must not unsubscribe anybody. Opening it
   * is not pressing it.
   */
  test('does nothing until the button is pressed', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/unsubscribe?t=2f2c6d0e-0f6f-4a3a-9d1c-6b5a1d9a8f11');

    await expect(page.getByRole('button', { name: 'Stop sending them' })).toBeVisible();

    // The switch on the settings screen still reads "on", which is the same
    // preference seen from the other side.
    await page.goto('/en/settings');
    await expect(page.getByRole('switch', { name: /occasional email/ })).toBeChecked();

    await page.goto('/en/unsubscribe?t=2f2c6d0e-0f6f-4a3a-9d1c-6b5a1d9a8f11');
    await page.getByRole('button', { name: 'Stop sending them' }).click();
    await expect(page.getByText('Done.', { exact: false })).toBeVisible();

    await page.goto('/en/settings');
    await expect(page.getByRole('switch', { name: /occasional email/ })).not.toBeChecked();
  });
});
