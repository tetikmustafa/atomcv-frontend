import { expect, test } from '@playwright/test';
import { asAccount } from './support/session';

/**
 * A phone.
 *
 * The old header put six routes and three controls on one unwrapped row, and
 * on a 375px screen it ran off the edge — which no test saw, because every
 * test ran at the desktop default. The app now has a sheet below `lg`, and
 * these are the two things only a browser at that width can say: the menu
 * reaches every route, and no page is wider than the screen.
 */
test.use({ viewport: { width: 375, height: 812 } });

test.describe('on a phone', () => {
  test('the menu opens, navigates and closes', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/profile');

    // The sidebar is not drawn at this width; the menu button is.
    await page.getByRole('button', { name: 'Open menu' }).click();
    const sheet = page.getByRole('dialog', { name: 'Menu' });
    await expect(sheet).toBeVisible();

    await sheet.getByRole('link', { name: 'Generate' }).click();

    await expect(page).toHaveURL('/en/generate');
    await expect(sheet).toBeHidden();
  });

  for (const path of ['/en', '/en/how-it-works', '/en/profile', '/en/generate', '/en/settings']) {
    test(`${path} is no wider than the screen`, async ({ page }) => {
      await asAccount(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
