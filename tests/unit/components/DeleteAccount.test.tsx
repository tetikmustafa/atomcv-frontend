import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { api } from '@/lib/api/client';
import { profileKeys, sessionKeys } from '@/lib/api/queryKeys';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import en from '@/messages/en.json';

const replace = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/settings',
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderSettings() {
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

  return { client, ...render(<SettingsScreen />, { wrapper: Wrapper }) };
}

/** Every account request, so "sent nothing" and "sent once" are assertable. */
let calls: string[] = [];
/** And every history read, so the count can be shown to cost one row. */
let history: string[] = [];

function record({ request }: { request: Request }) {
  if (request.url.endsWith('/api/v1/account')) calls.push(request.method);
  if (request.method === 'GET' && request.url.includes('/api/v1/generations?')) {
    history.push(request.url);
  }
}

beforeEach(() => {
  calls = [];
  history = [];
  replace.mockClear();
  server.events.on('request:start', record);
});

afterEach(() => server.events.removeListener('request:start', record));

describe('deleting an account', () => {
  /**
   * Not a capability: an anonymous caller does not have a narrower version of
   * this, they have no account. `capabilities` says nothing about it, and
   * should not.
   */
  it('is not offered to somebody who has no account', async () => {
    renderSettings();

    expect(await screen.findByText(/working without an account/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en.Settings.deleteAction }),
    ).not.toBeInTheDocument();
  });

  it('claims neither state until the session has answered', () => {
    renderSettings();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/working without an account/)).not.toBeInTheDocument();
  });

  /**
   * § 57.4: the endpoint takes no confirmation field because the screen **is**
   * the confirmation, and what it owes is a count — the same rule the
   * cascading deletes in the editor follow.
   */
  it('counts what goes before anything goes', async () => {
    signIn();
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: en.Settings.deleteAction }));

    const dialog = await screen.findByRole('alertdialog');
    // The fixture's profile: three sections and four items.
    expect(dialog).toHaveTextContent('3 sections');
    expect(dialog).toHaveTextContent('4 items');
    expect(calls).toHaveLength(0);
  });

  /**
   * The two survivors, said where somebody actually reads them rather than
   * only in the policy: cost history with the link cut, and a suppression
   * record that belongs to the address rather than to the account.
   */
  it('says what does not go, and why', async () => {
    signIn();
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: en.Settings.deleteAction }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('with the link to you cut');
    expect(dialog).toHaveTextContent('stays with the address rather than with the account');
  });

  it('deletes once and leaves for the home page', async () => {
    signIn();
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: en.Settings.deleteAction }));
    await userEvent.click(
      await screen.findByRole('button', { name: en.Settings.deleteConfirmAction }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(calls).toEqual(['DELETE']);
  });

  /**
   * The response clears the cookie, so what is left is a **fresh anonymous
   * session** rather than nothing. A screen that showed a locked door
   * afterwards would be describing a state the server does not produce.
   */
  it('leaves the caller anonymous rather than with nothing', async () => {
    signIn();
    const { client } = renderSettings();
    client.setQueryData(profileKeys.head(), { data: { headline: 'gone now' } });

    await userEvent.click(await screen.findByRole('button', { name: en.Settings.deleteAction }));
    await userEvent.click(
      await screen.findByRole('button', { name: en.Settings.deleteConfirmAction }),
    );

    await waitFor(
      () =>
        expect(client.getQueryData(sessionKeys.current())).toMatchObject({ authenticated: false }),
      { timeout: 3000 },
    );
    // Everything cached described an account that no longer exists.
    expect(client.getQueryData(profileKeys.head())).toBeUndefined();
  });
});

/**
 * `B-066`: the count used to be named without a number, because nothing
 * published one. `GET /generations` does now, and `total` is the account's
 * count rather than a page's — the only kind this screen could honestly use.
 */
describe('what the confirmation counts', () => {
  it('names how many resumes go with the account', async () => {
    signIn();
    // Two generations, so the number is not the one a bug would produce.
    await api.post('/generations', { acknowledgePreflight: false, coverLetter: false });
    await api.post('/generations', { acknowledgePreflight: false, coverLetter: false });

    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: en.Settings.deleteAction }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('all 2 resumes');
  });

  /**
   * Asked for with `limit: 1`: the number is the only thing wanted, and
   * `total` counts the account rather than the page.
   */
  it('asks for the number without asking for the rows', async () => {
    signIn();
    await api.post('/generations', { acknowledgePreflight: false, coverLetter: false });

    renderSettings();
    await screen.findByRole('button', { name: en.Settings.deleteAction });

    await waitFor(() => expect(history).toHaveLength(1));
    expect(new URL(history[0]!).searchParams.get('limit')).toBe('1');
  });
});
