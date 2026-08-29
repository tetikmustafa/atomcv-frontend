'use client';

/**
 * Turns an `ApiError` into a sentence, and a `Resolution` into a button label.
 *
 * Rule 8: the server sends translation keys, not prose. It has no idea what
 * language the user reads in, so `title` is a developer string for logs and
 * `code` is the key everything user-facing comes from.
 *
 * The awkward part is that both vocabularies are open. A code or an action
 * added server-side reaches a client built before it existed, and the one
 * thing that must not happen is a thrown render: an error panel that crashes
 * takes away the only description of what went wrong *and* the buttons out of
 * it. So an unknown key falls back rather than throwing, and says something
 * true while doing it.
 */

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import {
  formatErrorParams,
  MESSAGE_DEFAULTS,
  toRetryMinutes,
  type IcuValue,
} from '@/lib/errors/errorParams';
import { useQueryClient } from '@tanstack/react-query';
import { sessionKeys } from '@/lib/api/queryKeys';
import type { Session } from '@/lib/api/endpoints/auth';
import type { ErrorLike } from '@/lib/errors/errorLike';
import type { Resolution } from '@/types/domain';

/** What `toApiError` synthesises for a body it could not read. */
const FALLBACK_CODE = 'UNEXPECTED_ERROR';

/**
 * next-intl types `t` against the catalogue, which is exactly what cannot
 * hold here: the key is a server code from an open vocabulary. One cast, made
 * once, guarded by the `t.has` check at each call site — rather than an
 * inline assertion per call, where `as never` would also collapse the values
 * argument to `undefined` and quietly stop passing params at all.
 */
type LooseTranslator = ((key: string, values?: Record<string, IcuValue>) => string) & {
  has(key: string): boolean;
};

export function useErrorMessage() {
  const t = useTranslations('errors') as unknown as LooseTranslator;
  const locale = useLocale();
  const queryClient = useQueryClient();

  /**
   * Who is reading this, for the one code whose meaning depends on it.
   *
   * **Read out of the cache rather than subscribed to.** `useSession` would
   * work and would be worse: it is deliberately `staleTime: 0`, so every
   * error panel that appeared would issue a session request — a renderer of
   * sentences quietly becoming a thing that fetches. By the time any error is
   * on screen the app shell has already asked, so what is here is the same
   * answer without the second observer.
   *
   * `unknown` when it is not there yet, and that is a branch of its own
   * rather than a guess: telling an account holder their allowance is shared,
   * or an anonymous caller that they spent theirs, are both wrong (`B-053`).
   */
  const session = queryClient.getQueryData<Session>(sessionKeys.current());
  const caller =
    session === undefined ? 'unknown' : session.authenticated ? 'account' : 'anonymous';

  return useCallback(
    (error: Pick<ErrorLike, 'code' | 'params' | 'retryAfterSeconds'>): string => {
      const key = t.has(error.code) ? error.code : FALLBACK_CODE;
      const retryAfterMinutes = toRetryMinutes(error.retryAfterSeconds);

      return t(key, {
        ...MESSAGE_DEFAULTS,
        ...formatErrorParams(error.params, locale),
        // Last, and neither can collide with a wire param: one is derived
        // from a header the body has no field for, the other from a session
        // the server cannot see the far side of.
        ...(retryAfterMinutes === undefined ? {} : { retryAfterMinutes }),
        caller,
      });
    },
    [t, locale, caller],
  );
}

export function useResolutionLabel() {
  const t = useTranslations('resolutions') as unknown as LooseTranslator;
  const locale = useLocale();

  return useCallback(
    (resolution: Resolution): string | null => {
      // No fallback text. A button whose label we cannot resolve is worse
      // than no button: it would be an unexplained control on a screen the
      // user is already stuck on, and the server may have meant anything by
      // it. The panel drops it and keeps the ones it can name.
      if (!t.has(resolution.action)) return null;

      return t(resolution.action, formatErrorParams(resolution.params, locale));
    },
    [t, locale],
  );
}

/**
 * Turns the server's progress `label` into a phase name.
 *
 * Rule 8 again, and for the same reason: `B-038` changed the stream to send
 * `generation.phase.*` rather than an English sentence, because the progress
 * line is the most-read text in the product and a sentence would have to be
 * re-sent in every language the product ever gains.
 *
 * Two absences are handled here rather than at the call site:
 *
 * - **An empty label is not a key.** The snapshot frame carries `label: ''`
 *   (`F-010`), and resolving that would render `generation.phase.`.
 * - **An unknown phase gets no name at all.** The pipeline can grow one, and
 *   the bar is still true without a caption — inventing a name from the key
 *   would put `RENDERING_COVER_LETTER` in front of the user.
 */
export function usePhaseLabel() {
  const t = useTranslations() as unknown as LooseTranslator;

  return useCallback(
    (key: string | null): string | null => {
      if (!key || !t.has(key)) return null;
      return t(key);
    },
    [t],
  );
}
