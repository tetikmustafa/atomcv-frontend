import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { fixture } from '@/mocks/profileFixture';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import en from '@/messages/en.json';

const push = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
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

  return render(<SettingsScreen />, { wrapper: Wrapper });
}

let deletes: { ifMatch: string | null }[] = [];

function record({ request }: { request: Request }) {
  if (request.method === 'DELETE' && new URL(request.url).pathname === '/api/v1/profile') {
    deletes.push({ ifMatch: request.headers.get('If-Match') });
  }
}

beforeEach(() => {
  deletes = [];
  push.mockClear();
  server.events.on('request:start', record);
});

afterEach(() => server.events.removeListener('request:start', record));

/**
 * `DELETE /profile` had a client function and no caller. Starting again meant
 * re-importing over the top or deleting the whole account.
 */
describe('starting the profile again', () => {
  it('asks first, with the counts and the resumes that go with it', async () => {
    signIn();
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByRole('button', { name: en.Settings.deleteProfileAction }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/every resume made from this profile/);
    expect(deletes).toHaveLength(0);

    await user.click(
      within(dialog).getByRole('button', { name: en.Settings.deleteProfileConfirm }),
    );

    await waitFor(() => expect(deletes).toHaveLength(1));
    // The one call that cannot be undone carries the version it was asked of.
    expect(deletes[0]!.ifMatch).toMatch(/^"\d+"$/);
    await waitFor(() => expect(fixture.sections).toHaveLength(0));
    expect(push).toHaveBeenCalledWith('/onboarding');
  });

  it('is not offered without an account', async () => {
    renderSettings();

    expect(await screen.findByText(/narrower set/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en.Settings.deleteProfileAction }),
    ).not.toBeInTheDocument();
  });
});
