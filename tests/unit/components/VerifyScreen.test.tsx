import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyScreen } from '@/components/auth/VerifyScreen';
import { nextUpgrade } from '@/mocks/authFixture';
import { server } from '@/mocks/node';
import en from '@/messages/en.json';

const replace = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderVerify(props: { selector?: string; verifier?: string } = LINK) {
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

  return render(<VerifyScreen {...props} />, { wrapper: Wrapper });
}

const LINK = { selector: 'sel-1', verifier: 'ver-1' };

/** Every request the screen made, in order. */
let calls: string[] = [];

function record({ request }: { request: Request }) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/v1/auth/')) calls.push(`${request.method} ${path}`);
}

beforeEach(() => {
  calls = [];
  replace.mockClear();
  server.events.on('request:start', record);
  return () => server.events.removeListener('request:start', record);
});

const signIn = () => screen.findByRole('button', { name: en.Auth.verifyAction });

/**
 * Redeems the link once and takes that screen away, leaving a fresh one to
 * meet the refusal a spent link earns. Unmounted rather than left standing:
 * two screens in the document turn every query below into a guess about
 * which one answered.
 */
async function spend() {
  const first = renderVerify();
  await userEvent.click(await signIn());
  await waitFor(() => expect(replace).toHaveBeenCalled());
  first.unmount();
  replace.mockClear();

  renderVerify();
}

describe('redeeming a sign-in link', () => {
  /**
   * § 40.3, and the reason this screen exists at all: corporate mail scanners
   * click links by themselves, and a single-use token spent by a scanner
   * leaves the person it was sent to unable to sign in. Opening the page must
   * therefore do nothing to the token.
   */
  it('does not redeem anything by being opened', async () => {
    renderVerify();
    await signIn();

    expect(calls).not.toContain('POST /api/v1/auth/verify');
  });

  /**
   * `B-049`'s trap. The write carries the CSRF token from a cookie the
   * browser has never been given — somebody arriving from their inbox has no
   * `XSRF-TOKEN` — so the session read has to land first, or every magic-link
   * sign-in is a `403`.
   */
  it('reads the session before it writes anything', async () => {
    renderVerify();

    expect(screen.getByRole('button', { name: en.Auth.verifyAction })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());

    await userEvent.click(await signIn());

    await waitFor(() => expect(calls).toContain('POST /api/v1/auth/verify'));
    expect(calls.indexOf('GET /api/v1/auth/session')).toBeLessThan(
      calls.indexOf('POST /api/v1/auth/verify'),
    );
  });

  it('signs in and carries on when there is nothing to report', async () => {
    renderVerify();
    await userEvent.click(await signIn());

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
  });

  /**
   * § 41.3.3's outcome now arrives in the `200` body rather than in a URL
   * (`B-054`), and the same three sentences have to reach the reader over
   * this transport too.
   */
  it('stops to say what happened to the anonymous profile', async () => {
    nextUpgrade('kept_existing');
    renderVerify();
    await userEvent.click(await signIn());

    expect(await screen.findByText(en.Auth.upgrade.kept_existing)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: en.Auth.continue })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  /**
   * One answer for expired, already used, wrong verifier and never existed
   * (§ 40.4.1) — told apart, they tell a guesser which half of the guess was
   * right. The mock produces it the ordinary way: a link redeemed twice.
   */
  it('gives one answer for a link that does not work, and asks nothing about why', async () => {
    await spend();
    await userEvent.click(await signIn());

    expect(await screen.findByRole('alert')).toHaveTextContent('Links are single-use');
  });

  /**
   * And the button goes with it. Not a branch on the error code: the pair is
   * single-use, so whatever came back, sending it again cannot work — the
   * only honest control left is the one that asks for a new link.
   */
  it('offers a new link rather than a second press', async () => {
    await spend();
    await userEvent.click(await signIn());
    await screen.findByRole('alert');

    expect(screen.queryByRole('button', { name: en.Auth.verifyAction })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.Auth.backToSignIn })).toBeInTheDocument();
  });

  /**
   * A URL that never carried what it needed is not a failed sign-in, and it
   * gets no error code: mail clients wrap long links and cut them.
   */
  it('says a truncated link is truncated, and redeems nothing', () => {
    renderVerify({ selector: 'sel-1' });

    expect(screen.getByRole('alert')).toHaveTextContent(en.Auth.verifyMissing);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // The session read still happens — it is a hook, and it is harmless. What
    // must not happen is the write.
    expect(calls).not.toContain('POST /api/v1/auth/verify');
  });
});
