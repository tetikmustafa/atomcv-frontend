'use client';

/**
 * Light, dark, or the machine's choice.
 *
 * **`useSyncExternalStore` rather than an effect**, and the reason is
 * hydration: the server cannot know what is in this browser's storage, so a
 * control rendered from it would mismatch. `getServerSnapshot` says `system`
 * — which is what the server genuinely knows — and React swaps in the real
 * value on the client without a warning and without a frame of wrong label.
 * The *page* does not flicker either way; that is the head script's job, and
 * it has already run by the time this mounts.
 *
 * Subscribing to `storage` comes free with the same hook, and is worth
 * having: two tabs open on the product agree about the theme.
 *
 * **It lives in the app nav and nowhere else.** The landing and legal pages
 * ship no client JavaScript of their own by decision — they are first contact
 * and the thinnest point of the anonymous funnel — and they still follow the
 * system preference, because the head script runs everywhere. What a reader
 * gives up outside the app is the ability to *override* their machine, which
 * is not a choice anybody makes on a page they have been on for four seconds.
 */

import { useCallback, useId, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { NativeSelect } from '@/components/ui/native-select';
import {
  applyTheme,
  DARK_QUERY,
  isTheme,
  resolveTheme,
  storedTheme,
  storeTheme,
  THEMES,
  type Theme,
} from '@/lib/theme';
import { announce } from '@/stores/announcerStore';

/**
 * Both sources that can change the answer: another tab writing the choice,
 * and the machine changing its mind while the page is open.
 */
function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);

  window.addEventListener('storage', onChange);
  media.addEventListener('change', onChange);

  return () => {
    window.removeEventListener('storage', onChange);
    media.removeEventListener('change', onChange);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('Theme');
  // An id per instance: the sidebar and the phone's menu can both hold one.
  const id = useId();

  const theme = useSyncExternalStore(subscribe, storedTheme, () => 'system' as Theme);

  const choose = useCallback(
    (next: Theme) => {
      storeTheme(next);
      applyTheme(resolveTheme(next));
      // Rule 6: the change is a colour and nothing else, which is the exact
      // case a live region exists for.
      announce(t('announce', { theme: next }));
    },
    [t],
  );

  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {t('label')}
      </label>

      {/*
        A select rather than a cycling button. A single button that rotates
        through three states never says what the next press will do, and the
        third state — "follow the machine" — is the one nobody guesses is
        there.
      */}
      <NativeSelect
        id={id}
        value={theme}
        onChange={(event) => isTheme(event.target.value) && choose(event.target.value)}
        className="sm:w-full"
      >
        {THEMES.map((option) => (
          <option key={option} value={option}>
            {t('options', { theme: option })}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
