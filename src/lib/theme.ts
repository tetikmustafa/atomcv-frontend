/**
 * Light, dark, or whatever the machine says (CLAUDE.md · *Deferred by
 * Decision*, now decided).
 *
 * **Three states, not two.** A toggle that only flips light and dark takes
 * away "follow the system", which is what most people have already set once
 * and expect everything to obey. It is the default here, and it is also the
 * only state a first visit can honestly be in.
 *
 * **The class is written before the first paint**, by `THEME_SCRIPT` in the
 * document head. Anything that waits for React paints the light theme first
 * and then corrects itself, which is a white flash in a dark room — the
 * reason this task was held back rather than half-done.
 *
 * shadcn's init bound the dark variant to a `.dark` class and dropped the
 * `prefers-color-scheme` media query. That class is still the mechanism; what
 * was missing was anything to add it.
 */

export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

/** What is actually painted, once `system` has been resolved. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'atomcv-theme';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Reads the stored choice, or `system` when there is none.
 *
 * Every access is guarded. Storage can be blocked outright — a private window,
 * a browser set to refuse site data — and a theme preference is not worth
 * taking the page down for.
 */
export function storedTheme(): Theme {
  if (typeof window === 'undefined') return 'system';

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function storeTheme(theme: Theme) {
  if (typeof window === 'undefined') return;

  try {
    // `system` is stored rather than removed, so "I chose to follow the
    // machine" and "I have never chosen" stay the same thing on purpose:
    // both mean follow it, and there is nothing a third state would do
    // differently.
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Blocked storage. The choice still applies to this page; it just will
    // not survive a reload, which is the most a page can do about it.
  }
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}

/**
 * Puts the resolved theme on the document.
 *
 * Two things, not one. The class is what the `dark:` variants key off, and
 * `color-scheme` is what the **browser** keys off — form controls, scrollbars
 * and the canvas behind the page are the user agent's to paint, and without
 * it they stay light inside a dark page.
 */
export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;

  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

/**
 * The same logic, as a string, for a blocking `<script>` in the head.
 *
 * **It cannot import any of the above**, and that duplication is deliberate:
 * the script has to run before the bundle exists, so it is inlined into the
 * HTML and executed synchronously before the first paint. Keeping it short
 * enough to read is the only defence against the two copies drifting — and
 * `tests/unit/lib/theme.test.ts` runs this string against the same cases as
 * the module, so a drift fails rather than flickers.
 *
 * `try` around everything: a page that will not render because a theme could
 * not be read is a worse outcome than the wrong theme.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=t==="dark"||(t!=="light"&&matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})()`;
