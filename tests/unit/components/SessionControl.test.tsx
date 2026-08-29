import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionControl } from '@/components/auth/SessionControl';
import { profileKeys, sessionKeys } from '@/lib/api/queryKeys';
import { signIn } from '@/mocks/sessionFixture';
import en from '@/messages/en.json';

const replace = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/profile',
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderControl() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return { client, ...render(<SessionControl />, { wrapper: Wrapper }) };
}

beforeEach(() => {
  replace.mockClear();
});

describe('the sign in / sign out control', () => {
  /**
   * The two states are mutually exclusive claims about the reader. Guessing
   * one for the length of a request means either offering an account holder a
   * way in they do not need, or telling somebody signed in that they are not
   * — and the wrong one is clickable before it corrects itself.
   */
  it('claims neither state until the session has answered', () => {
    renderControl();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers the way in, and remembers where the reader was', async () => {
    renderControl();

    expect(await screen.findByRole('link', { name: en.Auth.signIn })).toHaveAttribute(
      'href',
      '/login?next=%2Fprofile',
    );
  });

  it('offers the way out to somebody signed in', async () => {
    signIn();
    renderControl();

    expect(await screen.findByRole('button', { name: en.Auth.signOut })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  /**
   * `useLogout` clears the cache rather than invalidating it, and the
   * difference is not housekeeping: everything cached was fetched *as
   * somebody*, and on a shared machine an invalidation leaves one person's CV
   * on screen until each query gets around to refetching.
   */
  it('throws away what was cached as the previous caller', async () => {
    signIn();
    const { client } = renderControl();
    client.setQueryData(profileKeys.head(), { headline: 'someone else' });

    await userEvent.click(await screen.findByRole('button', { name: en.Auth.signOut }));

    await waitFor(() => expect(client.getQueryData(profileKeys.head())).toBeUndefined());
  });

  /**
   * Home rather than where they stood. Every screen in the app is about the
   * caller's own profile, and the caller is now a fresh anonymous session
   * with an empty one — the same page showing nothing reads as data loss.
   */
  it('leaves for the home page once the session is gone', async () => {
    signIn();
    renderControl();

    await userEvent.click(await screen.findByRole('button', { name: en.Auth.signOut }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  /**
   * Signing out leaves an anonymous session rather than nothing: § 35.7's
   * endpoint stamps one for a caller that arrives without a cookie, so the
   * screen after this is the anonymous product and not a locked door.
   *
   * This proves it for the **module** flag only. The mock also has to
   * contradict its stored flag, and that half is unobservable here —
   * `localStorage` in this jsdom setup does not retain what it is given, so
   * the storage branch never runs. It is covered in the Playwright suite,
   * where storage is real and is the only way the browser can say who it is.
   */
  it('comes back anonymous', async () => {
    signIn();
    const { client } = renderControl();

    await userEvent.click(await screen.findByRole('button', { name: en.Auth.signOut }));

    await waitFor(() =>
      expect(client.getQueryData(sessionKeys.current())).toMatchObject({ authenticated: false }),
    );
  });
});
