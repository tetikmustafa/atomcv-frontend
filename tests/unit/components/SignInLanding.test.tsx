import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInLanding } from '@/components/auth/SignInLanding';
import { signIn } from '@/mocks/sessionFixture';
import en from '@/messages/en.json';

const replace = vi.fn();

/** jsdom has no App Router. Only the navigation calls matter here. */
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/auth/complete',
}));

function renderLanding(props: { next?: string; profile?: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<SignInLanding {...props} />, { wrapper: Wrapper });
}

beforeEach(() => {
  replace.mockClear();
});

describe('the OAuth landing page', () => {
  /**
   * The reason the page exists: a `SameSite=Strict` cookie is not sent on a
   * request whose redirect chain started at the provider, so the destination
   * would render signed out. The same-origin session read is what makes the
   * cookie visible — and it has to finish before anything moves.
   */
  it('waits for the session before sending anyone on', () => {
    signIn();
    renderLanding({ next: '/profile', profile: 'none' });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(en.Auth.completing);
  });

  it('goes where the caller was once the session answers', async () => {
    signIn();
    renderLanding({ next: '/profile', profile: 'none' });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
  });

  it('goes home rather than anywhere a hostile `next` names', async () => {
    signIn();
    renderLanding({ next: '//evil.example/login', profile: 'none' });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  /**
   * § 41.3.3's four values are not two. Two of these are the only notice the
   * person gets that two hours of anonymous work did not come with them, and
   * a sentence shown for the length of a redirect is a sentence nobody reads.
   */
  it.each([
    ['upgraded', en.Auth.upgrade.upgraded],
    ['kept_existing', en.Auth.upgrade.kept_existing],
    ['unavailable', en.Auth.upgrade.unavailable],
  ])('stops to say what happened to the profile: %s', async (profile, sentence) => {
    signIn();
    renderLanding({ next: '/profile', profile });

    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: en.Auth.continue })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  /**
   * `B-084`. An `upgraded` sign-in brought the generations across as well as
   * the profile, so with nothing else asked for the list is where the reader
   * goes — and a `next` still wins, because it is the screen they were sent
   * away from.
   */
  it('offers the resumes that came with an upgrade when no `next` was asked for', async () => {
    signIn();
    renderLanding({ profile: 'upgraded' });

    expect(await screen.findByText(en.Auth.upgrade.upgraded)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.Auth.continue })).toHaveAttribute(
      'href',
      '/history',
    );
  });

  /**
   * The most-walked path in the product. A confirmation nobody needed is a
   * step added to every ordinary sign-in.
   */
  it('says nothing at all when there was nothing to carry over', async () => {
    signIn();
    renderLanding({ next: '/profile' });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
    expect(screen.queryByText(en.Auth.upgrade.upgraded)).not.toBeInTheDocument();
  });

  /**
   * A fifth outcome would arrive with no way to tell whether it is good news
   * or bad, and both sentences we have make a claim. The cookie is unaffected,
   * so the sign-in still finishes.
   */
  it('carries on silently past an outcome it does not recognise', async () => {
    signIn();
    renderLanding({ next: '/profile', profile: 'merged' });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
  });

  /**
   * The one failure this page is placed to catch. Sending an anonymous caller
   * on to the app would hand them a slightly wrong screen on every route
   * afterwards, with nothing anywhere saying why.
   */
  it('stops when the session came back anonymous', async () => {
    renderLanding({ next: '/profile', profile: 'none' });

    expect(await screen.findByRole('alert')).toHaveTextContent(en.Auth.notSignedIn);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: en.Auth.backToSignIn })).toBeInTheDocument();
  });
});
