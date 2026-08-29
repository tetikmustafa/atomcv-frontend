import { expect, test } from '@playwright/test';
import { asAccount } from './support/session';

/**
 * Signing in and out, in a real browser.
 *
 * What only shows up here is the part that is not ours: the OAuth hop is a
 * top-level navigation to another origin, which the MSW worker bypasses by
 * design, so the seam is drawn at the button's `href` on one side and at
 * `/auth/complete` on the other — reached the same way the browser reaches
 * it, by going there.
 */
test.describe('the way in', () => {
  test('offers the providers this deployment published', async ({ page }) => {
    await page.goto('/en/login');

    await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/oauth/google/start?next=%2F',
    );
    await expect(page.getByRole('link', { name: 'Continue with GitHub' })).toBeVisible();
  });

  test('carries where the reader was into the sign-in link', async ({ page }) => {
    await page.goto('/en/profile');

    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/en/login?next=%2Fprofile',
    );
  });

  /**
   * The ordinary sign-in, and the one that must not stop to say anything:
   * `none` is most of them, and a confirmation nobody needed is a step added
   * to the most-walked path in the product.
   */
  test('lands, reads the session, and carries on to where the reader was', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/auth/complete?next=%2Fprofile&profile=none');

    await expect(page).toHaveURL('/en/profile');
  });

  /**
   * The opposite case. `kept_existing` is the only notice the person gets
   * that the CV they uploaded a moment ago did not come with them (§ 41.3.3),
   * so it has to survive being read.
   */
  test('stops when there is something to say about the profile', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/auth/complete?next=%2Fprofile&profile=kept_existing');

    await expect(page.getByText('Your account already had a profile')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/complete/);

    await page.getByRole('link', { name: 'Continue' }).click();
    await expect(page).toHaveURL('/en/profile');
  });

  /**
   * `B-048`: cancelling on a consent screen is an answer the product asked
   * for. A red panel with `role="alert"` would tell the reader something
   * broke when nothing did.
   */
  test('does not dress a cancelled sign-in up as a fault', async ({ page }) => {
    await page.goto('/en/auth/error?code=OAUTH_FAILED&reason=declined');

    await expect(page.getByRole('status')).toContainText("You didn't finish signing in");

    /*
      Scoped to `<main>`, and not as tidiness. Next.js appends its own route
      announcer to `<body>` with `role="alert"`, so an unscoped absence check
      here fails against a live region that is always present and has nothing
      to do with the page — the browser twin of the two-`role="alert"` trap
      the Announcer sets in the unit suite.
    */
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
  });
});

test.describe('the way out', () => {
  /**
   * The half the unit tests cannot see. `localStorage` in the jsdom setup
   * does not retain what it is given, so the mock's stored flag — the only
   * way a browser can say who it is — is only ever exercised here.
   *
   * A sign-out that left `account` in storage would have the very next
   * `/auth/session` answer with the account just signed out of: a button that
   * looks broken while the request behind it worked.
   */
  test('signs out, goes home, and stays signed out', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/profile');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/en');

    await page.goto('/en/profile');
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  });
});
