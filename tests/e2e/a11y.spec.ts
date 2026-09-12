import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { asAccount, seedSession } from './support/session';

/**
 * axe over the real pages, in a real browser (§ 39, § 55's `[B+F] Kalite`).
 *
 * **This is not the same check the unit suite runs.** Twenty-three component
 * tests already call `jest-axe`, and they run in jsdom — which has no layout,
 * no painting and no computed colour. So the rules that matter most on a
 * finished page are the ones jsdom cannot evaluate at all: contrast, an
 * element covered by another, a landmark structure that only exists once the
 * shell wraps the screen. Those are what this file adds.
 *
 * **And it is still not enough on its own.** Axe cannot tell you a skip link
 * left the tab order, that drag-and-drop has no keyboard path, or that a
 * progress bar announces nothing — all three are asserted as *behaviour*
 * elsewhere in this suite, which is the half a violation count never covers.
 *
 * The tags are WCAG A and AA only. `best-practice` is deliberately out: it
 * flags things like "heading levels should increase by one", which is advice
 * rather than a failure, and a suite that reports advice as a failure gets
 * muted.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();

  // The id and the first element, because a bare count says a page is broken
  // without saying where — and the failure message is the whole value of a
  // sweep that touches ten pages.
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    where: violation.nodes[0]?.target.join(' '),
  }));
}

/**
 * The screens a person actually walks through, each in the state they are
 * usually in rather than empty: a profile with atoms, a history with a row in
 * it, an application already recorded.
 */
const SCREENS = [
  { path: '/en', name: 'the landing page', account: false },
  { path: '/tr', name: 'the landing page in Turkish', account: false },
  { path: '/en/legal/privacy', name: 'the privacy policy', account: false },
  { path: '/en/login', name: 'the sign-in form', account: false },
  { path: '/en/onboarding', name: 'the import wizard', account: true },
  { path: '/en/profile', name: 'the profile editor', account: true },
  { path: '/en/generate', name: 'the generation form', account: true },
  { path: '/en/history', name: 'the history', account: true },
  { path: '/en/applications', name: 'the application tracker', account: true },
  { path: '/en/settings', name: 'the settings screen', account: true },
] as const;

test.describe('accessibility', () => {
  for (const screen of SCREENS) {
    test(`${screen.name} has no WCAG A or AA violations`, async ({ page }) => {
      if (screen.account) await asAccount(page);
      else await seedSession(page, 'anonymous');

      await page.goto(screen.path);
      // The sweep has to run against a settled page: axe reads computed
      // styles, and a screen still fetching its session renders neither
      // branch of half its decisions.
      await expect(page.locator('main#main')).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });
  }

  /**
   * The result screen, which cannot be reached by URL without first making
   * something — and which carries the densest composition in the product: a
   * fit report, a letter, a verdict form and Faz G's edit box.
   */
  test('the result screen has no WCAG A or AA violations', async ({ page }) => {
    await asAccount(page);
    await page.goto('/en/generate');

    await page
      .getByLabel('Job posting')
      .fill(
        'Acme is seeking a senior backend engineer to join a small platform team. ' +
          'Responsibilities: designing services, operating them in production, and ' +
          'mentoring the engineers around you. Requirements: several years of Java, ' +
          'PostgreSQL, container orchestration and a habit of writing things down. ' +
          'Preferred qualifications include message queues and infrastructure as code.',
      );
    await page.getByRole('button', { name: 'Generate', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible({
      timeout: 15_000,
    });

    expect(await violations(page)).toEqual([]);
  });
});

/**
 * The same sweep in the dark theme.
 *
 * A second palette is a second set of contrast ratios, and nothing in the
 * light run says anything about it — which is how a theme ships looking fine
 * to whoever built it and failing for everyone who reads in the dark. It
 * found one before it was even committed: red text on a tint of the same red
 * over a near-black page cannot reach AA at any lightness, so the destructive
 * button is solid there instead.
 *
 * A narrower list than the light sweep on purpose: the palette is shared, so
 * what differs between screens is composition rather than colour, and three
 * screens covering the marketing surface, a dense form and the settings is
 * where every token actually appears.
 */
test.describe('accessibility in the dark theme', () => {
  for (const screen of [
    { path: '/en', name: 'the landing page', account: false },
    { path: '/en/profile', name: 'the profile editor', account: true },
    { path: '/en/settings', name: 'the settings screen', account: true },
  ] as const) {
    test(`${screen.name} has no WCAG A or AA violations`, async ({ page }) => {
      if (screen.account) await asAccount(page);
      else await seedSession(page, 'anonymous');

      // Written before the first navigation, the way a returning reader's
      // browser already has it — so the head script applies it before paint
      // rather than the page being toggled after the fact.
      await page.addInitScript(() => window.localStorage.setItem('atomcv-theme', 'dark'));

      await page.goto(screen.path);
      await expect(page.locator('main#main')).toBeVisible();
      await expect(page.locator('html')).toHaveClass(/dark/);

      expect(await violations(page)).toEqual([]);
    });
  }
});
