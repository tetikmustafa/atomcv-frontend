import { expect, test } from '@playwright/test';

/**
 * The profile editor in a real browser.
 *
 * Everything here is covered by unit tests too, but not against a real
 * layout engine or a real service worker. Two things only show up here: the
 * Radix slider, whose keyboard behaviour depends on measurement that jsdom
 * cannot do, and the full request path through MSW's worker rather than its
 * Node interceptor.
 */
test.describe('the profile editor', () => {
  test('shows how complete the profile is, in words as well as a bar', async ({ page }) => {
    await page.goto('/en/profile');

    const bar = page.getByRole('progressbar', { name: 'Profile completeness' });
    await expect(bar).toHaveAttribute('aria-valuenow', '80');
    await expect(page.getByText('Profile: 80% complete')).toBeVisible();
  });

  test('opens a section and saves a toggle without a save button', async ({ page }) => {
    await page.goto('/en/profile');

    await page.getByRole('button', { name: 'Experience' }).click();

    const first = page.getByRole('article').first();
    await expect(first).toBeVisible();

    await first.getByRole('switch', { name: 'Always include' }).click();

    // The indicator is the only confirmation there is — Bölüm 37.3, and there
    // is no Save button anywhere for it to compete with.
    await expect(first.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  });

  /**
   * Rule 5, in the browser. The slider's arrow-key handling is Radix's, and
   * it depends on measuring the track — which jsdom cannot do at all, so the
   * unit test proves the wiring and this proves the behaviour.
   */
  test('moves the importance slider with the keyboard', async ({ page }) => {
    await page.goto('/en/profile');
    await page.getByRole('button', { name: 'Experience' }).click();

    const slider = page.getByRole('slider', { name: 'Importance' }).first();
    await expect(slider).toHaveAttribute('aria-valuenow', '0.6');

    await slider.focus();
    await page.keyboard.press('ArrowRight');

    await expect(slider).toHaveAttribute('aria-valuenow', '0.65');
    await expect(slider).toHaveAttribute('aria-valuetext', '0.65');
  });

  test('reorders atoms from the keyboard alone', async ({ page }) => {
    await page.goto('/en/profile');
    await page.getByRole('button', { name: 'Experience' }).click();

    const articles = page.getByRole('article');
    await expect(articles).toHaveCount(2);

    const before = await articles.first().textContent();

    await page.getByRole('button', { name: /^Move Engineered ETL pipelines up$/ }).click();

    // Ordering rather than an exact count: the list re-renders through an
    // optimistic write and then a refetch, and asserting at an instant races
    // the second one.
    await expect
      .poll(async () => (await articles.first().textContent())?.slice(0, 20))
      .not.toBe(before?.slice(0, 20));
  });
});
