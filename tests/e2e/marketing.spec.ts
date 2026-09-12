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

/**
 * ⚠️ The check every other test skipped past.
 *
 * All fifteen of them navigate by URL — `page.goto('/en/profile')` — so the
 * editor was exercised thoroughly while the question "can a person actually
 * get there?" was never asked. It could not: the landing page shipped with no
 * link into the product at all, and nothing failed, because nothing looked.
 *
 * A route that only a bookmark can reach is not reachable.
 */
test.describe('getting into the product', () => {
  test('the front page leads to the editor, in the reader’s language', async ({ page }) => {
    await page.goto('/tr');

    await page.getByRole('link', { name: 'Profilini oluşturmaya başla' }).click();

    await expect(page).toHaveURL('/tr/profile');
    // Not just the URL: the editor has to have rendered something.
    await expect(page.getByRole('progressbar', { name: 'Profil tamamlanma oranı' })).toBeVisible();
  });

  test('and keeps English readers in English', async ({ page }) => {
    await page.goto('/en');

    await page.getByRole('link', { name: 'Start building your profile' }).click();

    await expect(page).toHaveURL('/en/profile');
  });
});

/**
 * `B-059`: the sub-processor list has to name the email path and say where it
 * runs, because that address is processed outside the EU. A policy that is
 * silent about it is wrong before it is incomplete.
 */
test.describe('the privacy policy', () => {
  test('names where email is processed, and what deletion leaves behind', async ({ page }) => {
    await page.goto('/en/legal/privacy');

    await expect(page.getByText(/Resend, which sends through AWS SES/)).toBeVisible();
    await expect(page.getByText(/Tokyo\) region/)).toBeVisible();
    await expect(page.getByText(/outside the EU/)).toBeVisible();
    await expect(page.getByText(/with the link to you cut/)).toBeVisible();
  });
});

/**
 * What a crawler sees, served rather than merely generated.
 *
 * The unit suite checks the shapes; only this can say the two metadata routes
 * are actually reachable at the paths every crawler asks for, and that the
 * private half of the product carries `noindex` where `robots.txt` alone
 * would leave a linked URL eligible to be listed.
 */
test.describe('what the crawlers get', () => {
  test('serves robots.txt with the product half disallowed', async ({ request }) => {
    const response = await request.get('/robots.txt');
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain('Disallow: /en/profile');
    expect(body).toContain('Disallow: /tr/settings');
    // The marketing surface is the whole point of having a crawler here.
    expect(body).not.toContain('Disallow: /en\n');
  });

  test('serves a sitemap that says which pages are translations of which', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text();

    expect(body).toContain('/en/legal/privacy');
    expect(body).toContain('hreflang="tr"');
    expect(body).toContain('hreflang="x-default"');
    expect(body).not.toContain('/profile');
  });

  test('marks a person’s own screens noindex, and the landing page not', async ({ page }) => {
    await page.goto('/en/settings');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    await page.goto('/en');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  });
});
