import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  isTheme,
  resolveTheme,
  storedTheme,
  storeTheme,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
} from '@/lib/theme';

/**
 * A working `localStorage`, because the environment has none.
 *
 * Measured rather than assumed: under Node 25 the global `localStorage` that
 * reaches these tests is a **plain empty object** — no `getItem`, no
 * `setItem`, prototype `Object.prototype`. Everything in `src/` guards every
 * access for exactly this class of environment, so the product survives it;
 * a test about what is *stored* cannot.
 *
 * Stubbed here rather than in `tests/setup.ts` on purpose. Giving the whole
 * suite a working storage would switch `sessionFixture` onto its browser flag
 * path — the one Playwright uses — in fifty-seven files that were written
 * against the module flag, which is a behaviour change dressed as a fix.
 */
function memoryStorage() {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  } as unknown as Storage;
}

/** jsdom has no `matchMedia`; the whole question here is what it answers. */
function systemPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  document.documentElement.className = '';
  document.documentElement.style.colorScheme = '';
  systemPrefersDark(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the stored choice', () => {
  it('is system when nothing has been chosen', () => {
    expect(storedTheme()).toBe('system');
  });

  /**
   * A value nobody wrote — an old key, a hand-edited storage, a future
   * release's vocabulary — falls back rather than being applied. `system` is
   * the only honest answer to "I cannot read this".
   */
  it('falls back when the stored value is not one of ours', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'solarized');
    expect(storedTheme()).toBe('system');
    expect(isTheme('solarized')).toBe(false);
  });

  it('survives storage being blocked outright', () => {
    const blocked = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    // A private window, or a browser set to refuse site data. The page still
    // renders; it just renders in the system theme.
    expect(storedTheme()).toBe('system');
    expect(() => storeTheme('dark')).not.toThrow();

    blocked.mockRestore();
  });
});

describe('resolving', () => {
  it('asks the machine only for system', () => {
    systemPrefersDark(true);

    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });
});

describe('applying', () => {
  /**
   * Two things, and the second is the one that gets forgotten: `color-scheme`
   * is what the **browser** paints scrollbars, form controls and the canvas
   * behind the page with. Without it they stay light inside a dark page.
   */
  it('sets the class and the colour scheme together', () => {
    applyTheme('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyTheme('light');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

/**
 * The head script is a **second copy** of the logic above, written as a
 * string because it has to run before the bundle exists. This is what keeps
 * the two from drifting: both are run against the same cases, and a change to
 * one that is not made to the other fails here rather than flickering in
 * somebody's dark room.
 */
describe('the inline head script', () => {
  const cases = [
    { stored: null, system: 'dark', expected: 'dark' },
    { stored: null, system: 'light', expected: 'light' },
    { stored: 'system', system: 'dark', expected: 'dark' },
    { stored: 'system', system: 'light', expected: 'light' },
    { stored: 'dark', system: 'light', expected: 'dark' },
    { stored: 'light', system: 'dark', expected: 'light' },
    // The same fallback the module makes: an unreadable value is `system`.
    { stored: 'solarized', system: 'dark', expected: 'dark' },
  ] as const;

  it.each(cases)(
    'agrees with the module: stored $stored, system $system',
    ({ stored, system, expected }) => {
      systemPrefersDark(system === 'dark');
      if (stored) window.localStorage.setItem(THEME_STORAGE_KEY, stored);

      new Function(THEME_SCRIPT)();

      const fromScript = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      expect(fromScript).toBe(expected);
      expect(document.documentElement.style.colorScheme).toBe(expected);

      // And the module, from the same inputs.
      expect(resolveTheme(storedTheme())).toBe(expected);
    },
  );

  it('does not take the page down when storage throws', () => {
    const blocked = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => new Function(THEME_SCRIPT)()).not.toThrow();

    blocked.mockRestore();
  });
});
