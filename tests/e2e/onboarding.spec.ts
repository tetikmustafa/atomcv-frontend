import { expect, test, type Page } from '@playwright/test';
import { asAccount } from './support/session';

/**
 * Importing a CV, in a real browser.
 *
 * This is where the upload is actually proved. Everything under jsdom sends a
 * multipart body assembled by Node out of a file jsdom made, which is two
 * implementations meeting at a seam a browser does not have — here the file
 * the picker produces and the `fetch` that sends it are the same one, and the
 * boundary is written by the same code a user's browser would run.
 */
async function choose(page: Page, name: string, contents = 'a real CV would go here') {
  await page.setInputFiles('#cv-file', {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(contents),
  });
}

test.describe('bringing a CV', () => {
  test('is offered as the first thing the nav points at', async ({ page }) => {
    await page.goto('/en/profile');

    await page.getByRole('link', { name: 'Import CV' }).click();
    await expect(page).toHaveURL('/en/onboarding');
  });

  test('reads the file, then stops for the review', async ({ page }) => {
    await page.goto('/en/onboarding');

    await choose(page, 'cv.pdf');
    await page.getByRole('button', { name: 'Read my CV' }).click();

    await expect(page.getByRole('progressbar')).toBeVisible();

    // The review is a route of its own, so a reload lands on it rather than
    // back on the form.
    await expect(page).toHaveURL(/\/en\/onboarding\/review\?job=/);
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible();
  });

  /**
   * § 31.6's second design rule (`B-067`): sections start closed, and the ones
   * the import could not settle open themselves.
   *
   * The mock sends two warnings — one placed in Experience, one document-level
   * — so the note has to say both things and exactly one section has to be
   * open. Here rather than only in jsdom because the whole path is real: the
   * terminal SSE payload, the cache it lands in, and the editor underneath.
   */
  test('opens the section the import was unsure about', async ({ page }) => {
    await page.goto('/en/onboarding');

    await choose(page, 'cv.pdf');
    await page.getByRole('button', { name: 'Read my CV' }).click();

    const note = page.getByTestId('review-warnings');
    await expect(note).toContainText('unsure about 2 things');
    await expect(note).toContainText('nowhere in particular');

    // `B-069`: named, not only counted — and the located one says where.
    const named = page.getByTestId('review-warning-list').getByRole('listitem');
    await expect(named).toHaveText([
      'A date could not be read. In Experience.',
      'A line could not be given an English wording.',
    ]);

    // Exact: the row also carries 'Move Experience up' and its siblings.
    await expect(page.getByRole('button', { name: 'Experience', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Skills', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  /**
   * § 31.6: the step exists because extraction is never perfectly accurate,
   * and a mistake nobody looked at propagates into every CV afterwards. The
   * only way on is the button.
   */
  test('leads into the product once the reader has looked', async ({ page }) => {
    await page.goto('/en/onboarding');
    await choose(page, 'cv.pdf');
    await page.getByRole('button', { name: 'Read my CV' }).click();

    await page.getByRole('button', { name: 'Looks right — continue' }).click();
    await expect(page).toHaveURL('/en/generate');
  });

  /**
   * The accepted list has one owner. Nothing on this side embeds it — the
   * picker filters on nothing — so the sentence the reader gets is the
   * server's own (`B-051`).
   */
  test('names the formats it would have taken, without having known them', async ({ page }) => {
    await page.goto('/en/onboarding');

    await expect(page.locator('#cv-file')).not.toHaveAttribute('accept', /./);

    await page.setInputFiles('#cv-file', {
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not a CV'),
    });
    await page.getByRole('button', { name: 'Read my CV' }).click();

    await expect(page.locator('main').getByRole('alert')).toContainText('pdf, docx, tex, txt');
  });

  /**
   * `B-060`, and there is deliberately no third button: merging means
   * atom-level deduplication, which is Stage 4 work.
   */
  test('asks before it replaces a profile that already has something in it', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/onboarding');

    await choose(page, 'cv.pdf');
    await page.getByRole('button', { name: 'Read my CV' }).click();

    const panel = page.locator('main').getByRole('alert');
    await expect(panel).toContainText('already has a profile');
    await expect(panel.getByRole('button')).toHaveText([
      'Replace my profile with this CV',
      'Keep the profile I have',
    ]);

    await panel.getByRole('button', { name: 'Replace my profile with this CV' }).click();
    await expect(page).toHaveURL(/\/en\/onboarding\/review/);
  });
});
