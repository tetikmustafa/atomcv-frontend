import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthErrorNotice } from '@/components/auth/AuthErrorNotice';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderNotice(props: { code?: string; reason?: string }) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return render(<AuthErrorNotice {...props} />, { wrapper: Wrapper });
}

describe('where a sign-in that did not finish lands', () => {
  /**
   * `B-048` in one test: cancelling on a consent screen is an answer the
   * product asked for, not a fault. A red panel with `role="alert"` would
   * tell the reader something broke when nothing did.
   */
  it('treats a declined sign-in as an answer, not an error', () => {
    renderNotice({ code: 'OAUTH_FAILED', reason: 'declined' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      "You didn't finish signing in with that provider",
    );
  });

  it('does raise the panel for something that actually went wrong', () => {
    renderNotice({ code: 'OAUTH_FAILED', reason: 'provider_unavailable' });

    expect(screen.getByRole('alert')).toHaveTextContent("That provider didn't answer");
  });

  /**
   * Seven reasons behind one code, all of them in an ICU `select`. An eighth
   * has to reach the `other` branch — a *missing* argument renders the
   * message as its own key, which is the failure `SELECT_DEFAULTS` exists for.
   */
  it.each([
    ['a reason nobody has written a branch for', { reason: 'moon_phase' }],
    ['no reason at all', {}],
  ])('says something true given %s', (_name, props) => {
    renderNotice({ code: 'OAUTH_FAILED', ...props });

    expect(screen.getByRole('alert')).toHaveTextContent("Signing in didn't work.");
  });

  /**
   * The route means one thing, so a URL that arrives without a code still
   * resolves to a sentence rather than to `errors.undefined`.
   */
  it('reads a bare URL as the failure this route is for', () => {
    renderNotice({ reason: 'state_invalid' });

    expect(screen.getByRole('alert')).toHaveTextContent("That sign-in didn't finish");
  });

  it('offers the way back', () => {
    renderNotice({ code: 'OAUTH_FAILED', reason: 'declined' });

    expect(screen.getByRole('link', { name: en.Auth.backToSignIn })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
