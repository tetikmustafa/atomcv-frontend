import { expect, test } from '@playwright/test';

test.describe('locale routing', () => {
  test('sends a locale-less request to the default language', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/en');
  });

  test('follows the browser language when it is one we support', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'tr-TR' });
    const page = await context.newPage();

    await page.goto('/');
    await expect(page).toHaveURL('/tr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');

    await context.close();
  });

  test('serves each language from its own catalogue', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByText('Build your profile once')).toBeVisible();

    await page.goto('/tr');
    await expect(page.getByText('Profilini bir kez oluştur')).toBeVisible();
  });
});

test.describe('skip link', () => {
  /**
   * The point of a skip link is that the first Tab press reaches it. Hiding
   * it in a way that also removes it from the tab order is the usual failure,
   * and it is invisible to anyone testing with a mouse (Bölüm 39.2).
   */
  test('is the first thing the keyboard reaches, and moves focus to main', async ({ page }) => {
    await page.goto('/en');

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });
});

test.describe('legal documents', () => {
  test('are reachable from the footer and keep the locale', async ({ page }) => {
    await page.goto('/tr');

    await page.getByRole('link', { name: 'Gizlilik' }).click();
    await expect(page).toHaveURL('/tr/legal/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gizlilik Politikası');
  });

  test('say plainly that they are drafts', async ({ page }) => {
    await page.goto('/en/legal/terms');
    await expect(page.getByRole('note')).toContainText('draft');
  });
});
