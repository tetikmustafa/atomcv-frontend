'use client';

/**
 * The one way out of a refusal that says "this needs an account" (`B-081`).
 *
 * § 35.7.2 made the three anonymous limits real: the atom controls, the
 * alternative wordings and the sixtieth atom are refused by the server now
 * rather than merely described by `capabilities`. Each refusal arrives with
 * `sign_up` in `resolutions`, and until this existed the profile editor drew
 * that button — `ErrorPanel` defaults to drawing everything it can name — and
 * did nothing when it was pressed, because no caller in the editor passed an
 * `onResolve`.
 *
 * So this is deliberately narrow. It carries out exactly one action and
 * `canResolve` admits exactly that one, which means a resolution the editor
 * cannot perform keeps being dropped rather than drawn as dead furniture. It
 * invents nothing: the button appears only where the server sent it.
 *
 * **`next` is the screen the reader was on**, not a fixed destination. The
 * refusal happened in the middle of somebody's own work — one slider, one
 * button — and coming back to the editor is the difference between finishing
 * that edit and hunting for where they were.
 */

import { useCallback } from 'react';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import type { Resolution } from '@/types/domain';

/** The only action this handles. */
const SIGN_UP = 'sign_up';

export function useAccountResolution() {
  const router = useRouter();
  // Unprefixed, because next-intl's router adds the locale back on the way
  // out. A `next` that already carried one would be prefixed twice and land
  // on `/tr/tr/profile` — a 404 at the end of a successful sign-in, which is
  // the case `safeReturnPath` strips for on arrival.
  const pathname = usePathname();

  const onResolve = useCallback(
    (resolution: Resolution) => {
      if (resolution.action !== SIGN_UP) return;

      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    },
    [router, pathname],
  );

  const canResolve = useCallback((action: Resolution['action']) => action === SIGN_UP, []);

  return { onResolve, canResolve };
}
