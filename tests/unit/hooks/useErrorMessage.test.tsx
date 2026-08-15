import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useErrorMessage, useResolutionLabel } from '@/hooks/useErrorMessage';
import { ApiError } from '@/lib/api/errors';
import en from '@/messages/en.json';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('resolving an error to a sentence', () => {
  it('reads the message from the code, never from the server’s title', () => {
    const { result } = renderHook(() => useErrorMessage(), { wrapper });

    const sentence = result.current(
      new ApiError({
        status: 409,
        code: 'CONFLICTING_PREFERENCES',
        // Rule 8: developer-facing, and it is in the wrong language for this
        // user anyway. It must not reach the screen.
        title: 'Pinned content exceeds the page limit',
        params: { pinnedPages: 2.3, maxPages: 1 },
      }),
    );

    expect(sentence).toContain('2.3');
    expect(sentence).toContain('one page');
    expect(sentence).not.toContain('Pinned content exceeds');
  });

  /**
   * The vocabulary is open by decision. A client built today will meet codes
   * added tomorrow, and the one thing that must not happen on an error screen
   * is a thrown render: it would take away both the explanation and the
   * buttons out of the situation.
   */
  it('falls back to a real sentence for a code it has never heard of', () => {
    const { result } = renderHook(() => useErrorMessage(), { wrapper });

    const sentence = result.current(new ApiError({ status: 418, code: 'SOMETHING_NEW' }));

    expect(sentence).toBe(en.errors.UNEXPECTED_ERROR);
    expect(sentence).not.toContain('SOMETHING_NEW');
  });

  /** What `toApiError` produces when the body could not be read at all. */
  it('has a sentence for the synthetic code', () => {
    const { result } = renderHook(() => useErrorMessage(), { wrapper });

    expect(result.current(new ApiError({ status: 500, code: 'UNEXPECTED_ERROR' }))).toBe(
      en.errors.UNEXPECTED_ERROR,
    );
  });
});

describe('labelling a resolution', () => {
  it('interpolates the params the server attached', () => {
    const { result } = renderHook(() => useResolutionLabel(), { wrapper });

    expect(result.current({ action: 'increase_page_limit', params: { maxPages: 3 } })).toBe(
      'Allow 3 pages',
    );
  });

  /**
   * An unnamed button is worse than a missing one: the user is already stuck,
   * and a control whose meaning we cannot state might do anything. Dropping it
   * keeps the rest of the row usable.
   */
  it('returns nothing for an action it cannot name', () => {
    const { result } = renderHook(() => useResolutionLabel(), { wrapper });

    expect(result.current({ action: 'teleport_to_success' })).toBeNull();
  });
});
