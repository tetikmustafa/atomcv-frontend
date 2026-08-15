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
import { formatErrorParams, type IcuValue } from '@/lib/errors/errorParams';
import type { ApiError } from '@/lib/api/errors';
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

  return useCallback(
    (error: Pick<ApiError, 'code' | 'params'>): string => {
      const key = t.has(error.code) ? error.code : FALLBACK_CODE;

      return t(key, formatErrorParams(error.params, locale));
    },
    [t, locale],
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
