import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { server } from '@/mocks/node';
import en from '@/messages/en.json';

function offering(providers: string[]) {
  server.use(http.get('*/api/v1/auth/providers', () => HttpResponse.json(providers)));
}

function renderLogin(next = '/profile') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<LoginScreen next={next} />, { wrapper: Wrapper });
}

describe('the sign-in screen', () => {
  it('draws one button per provider the deployment published, and no others', async () => {
    renderLogin();

    const google = await screen.findByRole('link', { name: 'Continue with Google' });
    expect(google).toHaveAttribute('href', '/api/v1/auth/oauth/google/start?next=%2Fprofile');
    expect(screen.getByRole('link', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  /**
   * A top-level navigation, not a fetch: the provider's consent screen has to
   * arrive with its own address in the address bar. An anchor is also
   * keyboard-reachable without anyone having to remember rule 5.
   */
  it('reaches the provider by navigating, not by clicking a handler', async () => {
    renderLogin();

    const google = await screen.findByRole('link', { name: 'Continue with Google' });
    expect(google.tagName).toBe('A');
  });

  /**
   * The id vocabulary is the server's and it is open. Hiding a provider we
   * have no spelling for would take away a way in because a line was missing
   * from a map; `gitlab` reads worse than `GitLab` and still signs the person
   * in.
   */
  it('still offers a provider it has no display name for', async () => {
    offering(['gitlab']);
    renderLogin();

    expect(await screen.findByRole('link', { name: 'Continue with gitlab' })).toHaveAttribute(
      'href',
      '/api/v1/auth/oauth/gitlab/start?next=%2Fprofile',
    );
  });

  it('says so when the deployment configured none', async () => {
    offering([]);
    renderLogin();

    expect(await screen.findByText(en.Auth.unavailable)).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  /**
   * Not the same as an empty list, and the difference is a wrong sentence:
   * "there is no way to sign in here" must not be shown for the moment the
   * request is still open, only to be replaced by two buttons.
   */
  it('claims nothing while the list is still on its way', () => {
    renderLogin();

    expect(screen.queryByText(en.Auth.unavailable)).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderLogin();
    await screen.findByRole('link', { name: 'Continue with Google' });

    await waitFor(async () => expect(await axe(container)).toHaveNoViolations());
  });
});
