import type { Page } from '@playwright/test';
import { MOCK_SESSION_KEY } from '../../../src/mocks/sessionFixture';

/**
 * Says who the browser is, before the first navigation.
 *
 * There is no sign-in endpoint to call — the real one redirects to Google,
 * and the mocks deliberately do not invent a stand-in (see `handlers.ts`).
 * The page carries the answer instead, in the one place Playwright and the
 * MSW handlers can both reach: `localStorage`.
 *
 * **It seeds rather than sets**, and that distinction is the whole reason
 * this is worth a file. `addInitScript` runs before *every* navigation, so an
 * unconditional write would re-sign-in the browser on the first page load
 * after the sign-out button worked — and the test asserting that sign-out
 * stuck would fail with the button innocent.
 */
export async function seedSession(page: Page, kind: 'account' | 'anonymous') {
  await page.addInitScript(
    ([key, value]) => {
      const existing = window.localStorage.getItem(key!);
      if (existing === null) window.localStorage.setItem(key!, value!);
    },
    [MOCK_SESSION_KEY, kind],
  );
}

/** The common case, and the one the atom controls need (§ 35.7). */
export async function asAccount(page: Page) {
  await seedSession(page, 'account');
}
