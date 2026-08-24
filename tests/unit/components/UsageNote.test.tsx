import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageNote } from '@/components/generation/UsageNote';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { renderHook } from '@testing-library/react';
import { ApiError } from '@/lib/api/errors';
import { generations, QUOTA } from '@/mocks/generationFixture';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';

function wrapperFor(locale: 'en' | 'tr') {
  const messages = locale === 'en' ? en : tr;

  return function Wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  };
}

describe('the usage note', () => {
  it('shows what is left before the user spends it', async () => {
    generations.usage.generation = 2;

    render(<UsageNote />, { wrapper: wrapperFor('en') });

    await waitFor(() =>
      expect(screen.getByTestId('usage-count')).toHaveTextContent(`2 of ${QUOTA.generation}`),
    );
  });

  /**
   * `profile_extract` always arrives — a missing entry would mean the metric
   * does not exist, never that nothing was used (`B-039`). Drawing it is a
   * different question: profile import is Stage 3, and a counter for
   * something the product cannot do is noise.
   */
  it('draws only the metric this screen is about', async () => {
    render(<UsageNote />, { wrapper: wrapperFor('en') });

    await waitFor(() => expect(screen.getByTestId('usage-note')).toBeInTheDocument());
    expect(screen.getByTestId('usage-note')).not.toHaveTextContent('Profile imports');
  });

  it('says nothing at all until it knows', () => {
    const { container } = render(<UsageNote />, { wrapper: wrapperFor('en') });

    // Context, not content. A screen that opens with a spinner over a side
    // note has buried what the user came for.
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the refusal that follows', () => {
  /**
   * The server sends `metric` as a wire token — `generation`,
   * `profile_extract` — and it is not a word in anyone's language. It has to
   * be chosen between in the catalogue rather than dropped into the sentence,
   * or a Turkish reader is told they used their "generation" allowance.
   */
  it.each([
    ['en', en, 'resume'],
    ['tr', tr, 'CV'],
  ] as const)(
    'names the metric in %s rather than passing the wire token through',
    (locale, catalogue, expected) => {
      const { result } = renderHook(() => useErrorMessage(), { wrapper: wrapperFor(locale) });

      const sentence = result.current(
        new ApiError({
          status: 429,
          code: 'QUOTA_EXCEEDED',
          params: { metric: 'generation', resetsAt: '2026-08-25T00:00:00Z' },
        }),
      );

      expect(sentence).toContain(expected);
      expect(sentence).not.toContain('generation');
      // The instant, in the reader's own zone and with the day on it: a reset
      // "at 03:00" reads as soon when it is twenty-two hours away (`F-007`).
      expect(sentence).toMatch(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/);
      expect(catalogue.errors.QUOTA_EXCEEDED).toContain('select');
    },
  );
});
