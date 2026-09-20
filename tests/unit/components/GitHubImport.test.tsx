import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubImport } from '@/components/profile/GitHubImport';
import { profileKeys } from '@/lib/api/queryKeys';
import { server } from '@/mocks/node';
import { useAnnouncerStore } from '@/stores/announcerStore';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

let client: QueryClient;

/** Every GitHub request, with its body, so "writes nothing" can be asserted. */
let calls: { url: string; body: Promise<string> }[] = [];

function record({ request }: { request: Request }) {
  if (request.url.includes('/profile/github')) {
    calls.push({ url: request.url, body: request.clone().text() });
  }
}

beforeEach(() => {
  calls = [];
  useAnnouncerStore.getState().clear();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  server.events.on('request:start', record);
  return () => server.events.removeListener('request:start', record);
});

function renderImport() {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<GitHubImport />, { wrapper: Wrapper });
}

const look = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: en.Editor.github.look }));

/**
 * Bringing in what a public GitHub account already says (`B-106`, § 31.8).
 *
 * The rule is "offered, never added automatically", and the split into two
 * calls is how it is kept. What is worth pinning is that the split survives
 * on screen as well as on the wire.
 */
describe('adding projects from GitHub', () => {
  it('writes nothing when it is only looking', async () => {
    const user = userEvent.setup();
    renderImport();

    await look(user);
    await screen.findByText('query-monitor');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('/github/suggestions');
    // The other endpoint is the only one that writes, and it has not been
    // called: the first step reads and returns.
    expect(calls.some((call) => call.url.includes('/github/apply'))).toBe(false);
  });

  /**
   * Nothing arrives ticked. A pre-selected list would make "offered" a
   * formality — the fastest way through the screen would be to accept all of
   * it, which is the automatic addition the rule forbids.
   */
  it('offers everything unticked, and cannot be applied until something is picked', async () => {
    const user = userEvent.setup();
    renderImport();

    await look(user);
    await screen.findByText('query-monitor');

    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Add / })).toBeDisabled();
  });

  /**
   * A merge and a new project do different things to somebody's own writing,
   * so the screen says which **before** the box is ticked rather than after.
   */
  it('says what each one would do, and does not say the same thing twice', async () => {
    const user = userEvent.setup();
    renderImport();

    await look(user);
    await screen.findByText('query-monitor');

    // The one carrying `matchedEntryId`: their sentences are left alone.
    expect(screen.getByTestId('github-effect-query-monitor')).toHaveTextContent(
      /leaves your sentences alone/,
    );
    // The one without: words nobody in this profile wrote do arrive.
    expect(screen.getByTestId('github-effect-ingest-bench')).toHaveTextContent(
      /GitHub's own description/,
    );
  });

  it('sends only what was picked, and says how many landed', async () => {
    const user = userEvent.setup();
    renderImport();

    await look(user);
    await screen.findByText('query-monitor');

    await user.click(screen.getByRole('checkbox', { name: 'ingest-bench' }));
    await user.click(screen.getByRole('button', { name: /Add / }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(JSON.parse(await calls[1]!.body)).toMatchObject({ repositories: ['ingest-bench'] });

    await waitFor(() =>
      expect(useAnnouncerStore.getState().announcement?.message).toBe('One project added'),
    );
  });

  /**
   * An apply can add projects and merge into existing entries in one
   * transaction, so sections, entries and atoms may all have moved. The whole
   * profile is dropped rather than a corner of it.
   */
  it('drops what was cached about the profile it just changed', async () => {
    const user = userEvent.setup();
    client.setQueryData(profileKeys.head(), { data: { headline: 'before' } });
    renderImport();

    await look(user);
    await screen.findByText('query-monitor');

    await user.click(screen.getByRole('checkbox', { name: 'ingest-bench' }));
    await user.click(screen.getByRole('button', { name: /Add / }));

    await waitFor(() => expect(client.getQueryState(profileKeys.head())?.isInvalidated).toBe(true));
  });

  /** And the spent list goes: offering it again would invite a second write. */
  it('clears the list once it has been applied', async () => {
    const user = userEvent.setup();
    renderImport();

    await look(user);
    await screen.findByText('query-monitor');

    await user.click(screen.getByRole('checkbox', { name: 'ingest-bench' }));
    await user.click(screen.getByRole('button', { name: /Add / }));

    await waitFor(() => expect(screen.queryByText('ingest-bench')).toBeNull());
  });

  /**
   * An account that does not exist, a GitHub that will not answer and one
   * with nothing significant in it are the same empty list — none of them is
   * something a person can act on, so the screen says the one true thing
   * rather than guessing which happened.
   */
  it('says one thing about an empty answer rather than guessing why', async () => {
    const user = userEvent.setup();
    renderImport();

    await user.type(screen.getByLabelText(en.Editor.github.usernameLabel), 'nobody');
    await look(user);

    expect(await screen.findByTestId('github-empty')).toHaveTextContent(en.Editor.github.empty);
    // Not an error panel: nothing went wrong.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  /**
   * Absent rather than empty. Without a username the server reads the account
   * named in the profile's own contact block — the one the CV shows an
   * employer — and an empty string would be a username nobody has.
   */
  it('sends no username at all when the field was left alone', async () => {
    const user = userEvent.setup();
    renderImport();

    await look(user);
    await screen.findByText('query-monitor');

    expect(JSON.parse(await calls[0]!.body)).not.toHaveProperty('username');
  });

  it('has no accessibility violations with a list on screen', async () => {
    const user = userEvent.setup();
    const { container } = renderImport();

    await look(user);
    await screen.findByText('query-monitor');

    expect(await axe(container)).toHaveNoViolations();
  });
});
