import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { SkipLink } from '@/components/layout/SkipLink';
import en from '@/messages/en.json';

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('SkipLink', () => {
  /**
   * The failure mode this guards against: hiding the link with `display:
   * none` or `hidden` removes it from the tab order, which turns the one
   * control that helps keyboard users into decoration. It has to be a real,
   * reachable link (Bölüm 39.2).
   */
  it('is a link to the main landmark, reachable by name', () => {
    renderWithIntl(<SkipLink />);

    const link = screen.getByRole('link', { name: 'Skip to content' });
    expect(link).toHaveAttribute('href', '#main');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithIntl(<SkipLink />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
