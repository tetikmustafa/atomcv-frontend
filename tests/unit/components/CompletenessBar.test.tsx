import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';

function renderBar(value: number, locale: 'en' | 'tr' = 'en') {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={locale === 'tr' ? tr : en}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return render(<CompletenessBar value={value} />, { wrapper: Wrapper });
}

describe('profile completeness', () => {
  /**
   * The same trap the error catalogue hit from the other side: the value
   * arrives as 0-100 and `Intl` percent expects a fraction, so passing it
   * straight through renders "2,800%" — wrong by two orders of magnitude and
   * perfectly plausible-looking.
   */
  it('renders the server’s 0-100 value as the percentage it is', () => {
    renderBar(28);

    expect(screen.getByText('Profile: 28% complete')).toBeInTheDocument();
  });

  it('handles both ends without inventing a number', () => {
    renderBar(0);
    expect(screen.getByText('Profile: 0% complete')).toBeInTheDocument();

    renderBar(100);
    expect(screen.getByText('Profile: 100% complete')).toBeInTheDocument();
  });

  /** Rule 9: the sign moves with the language, and so does the separator. */
  it('formats through Intl rather than by concatenation', () => {
    renderBar(28, 'tr');

    expect(screen.getByText('Profil: %28 tamamlandı')).toBeInTheDocument();
  });

  /**
   * Rule 6. The bar is a picture of the number; a screen reader gets the
   * number, and a sentence rather than a bare "28".
   */
  it('carries the value in text, not only in the width of a bar', () => {
    renderBar(28);

    const bar = screen.getByRole('progressbar', { name: 'Profile completeness' });
    expect(bar).toHaveAttribute('aria-valuenow', '28');
    expect(bar).toHaveAttribute('aria-valuetext', 'Profile: 28% complete');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderBar(28);
    expect(await axe(container)).toHaveNoViolations();
  });
});
