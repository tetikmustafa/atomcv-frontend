import { expect, test } from '@playwright/test';
import { asAccount } from './support/session';

/**
 * Light, dark, or the machine's choice.
 *
 * The palette itself is measured in `tests/unit/lib/palette.test.ts` and the
 * dark screens are swept in `a11y.spec.ts`. What is left is the part only a
 * browser can answer: that the choice survives a navigation and is applied
 * **before** anything paints.
 */

test.describe('the theme toggle', () => {
  test('applies the choice before the first paint, and keeps it', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/profile');

    // Nothing chosen, and the test browser reports a light system.
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.getByLabel('Colour theme').selectOption('dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    /*
      The half that matters. On a reload the class has to be there **before**
      React runs, or the page paints light and corrects itself — a white flash
      in a dark room, which is the reason this was held back rather than
      half-done. Asserting it on a fresh navigation is as close as Playwright
      gets to asserting "before paint".
    */
    await page.goto('/en/history');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveAttribute('style', /color-scheme:\s*dark/);
  });

  /**
   * Three states, not two: "follow the machine" is the default and has to be
   * reachable again after somebody has chosen otherwise.
   */
  test('can be handed back to the system', async ({ page }) => {
    await asAccount(page);
    await page.addInitScript(() => window.localStorage.setItem('atomcv-theme', 'dark'));
    await page.goto('/en/profile');

    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByLabel('Colour theme').selectOption('system');

    // The test browser reports a light system, so handing it back is visible.
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
