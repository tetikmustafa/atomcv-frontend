import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { History } from '@/components/generation/History';
import { generations, TERMINAL_AT, type MockJob } from '@/mocks/generationFixture';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/history',
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    'aria-label'?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * Finished generations, put straight into the mock's job list.
 *
 * Not made by calling `POST /generations` twenty-one times: that would spend a
 * daily allowance the endpoint is right to enforce, and the test would then be
 * measuring the quota gate rather than the list.
 */
function seedGenerations(count: number, shape: Partial<MockJob> = {}) {
  for (let index = 0; index < count; index += 1) {
    generations.jobs.push({
      jobId: `job-${index}`,
      kind: 'generation',
      generationId: `gen-${String(index).padStart(2, '0')}`,
      // A second apart and descending, so "newest first" is a claim the rows
      // can actually contradict.
      startedAt: Date.now() - TERMINAL_AT - index * 1000,
      outcome: 'completed',
      contentLanguage: 'en',
      ...shape,
    });
  }
}

/** Every history read, so the second page can be shown to carry a cursor. */
let asked: string[] = [];

function record({ request }: { request: Request }) {
  if (request.method === 'GET' && request.url.includes('/api/v1/generations?')) {
    asked.push(request.url);
  }
  // The unparameterised form the hook sends for the first page.
  if (request.method === 'GET' && request.url.endsWith('/api/v1/generations')) {
    asked.push(request.url);
  }
}

function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en} formats={formats}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<History />, { wrapper: Wrapper });
}

beforeEach(() => {
  asked = [];
  server.events.on('request:start', record);
  return () => server.events.removeListener('request:start', record);
});

describe('the history', () => {
  /**
   * § 33.4: anonymous mode is fully functional and only narrower. The sentence
   * says what is different — the resume is still built and downloaded — rather
   * than presenting a locked door.
   */
  it('says what an anonymous session gets instead, and asks for nothing', async () => {
    renderHistory();

    expect(await screen.findByText(/only listed here for accounts/)).toBeInTheDocument();
    expect(asked).toHaveLength(0);
  });

  /**
   * Gated on the server's `capabilities`, never on an assumption — and three
   * states, not two: before the session answers, neither sentence is true.
   */
  it('claims neither state until the session has answered', () => {
    signIn();
    renderHistory();

    expect(screen.queryByText(/only listed here for accounts/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('says the list is empty rather than saying nothing', async () => {
    signIn();
    renderHistory();

    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it('lists what the account has made, newest first, each one openable', async () => {
    signIn();
    seedGenerations(3);
    renderHistory();

    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(3);

    // Seeded descending by `startedAt`, so the newest is `gen-00`.
    expect(within(rows[0]!).getByRole('link')).toHaveAttribute('href', '/generations/gen-00');
    expect(within(rows[2]!).getByRole('link')).toHaveAttribute('href', '/generations/gen-02');
  });

  /**
   * The row carries no title — the label a history wants is read from the
   * posting, and no response returns it (`F-022`). What it can say honestly is
   * the facts, and they are what names the link for a screen reader.
   */
  it('names a row by its facts, since it has no title to give', async () => {
    signIn();
    seedGenerations(1);
    renderHistory();

    const link = await screen.findByRole('link');

    expect(link).toHaveAccessibleName(/Open the resume:/);
    expect(link).toHaveTextContent('one page');
    // Through `Intl.DisplayNames`, not a hand-written map (rule 9).
    expect(link).toHaveTextContent('English');
  });

  /**
   * A generation that did not finish has no document behind it, so its row is
   * not a link: the only thing that screen could show is an error the label
   * already gave.
   */
  it('does not offer a way into a generation that failed', async () => {
    signIn();
    seedGenerations(1, { outcome: 'failed' });
    renderHistory();

    expect(await screen.findByText(/did not finish/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  /**
   * Twenty-one, so the two numbers differ: `total` counts the account and the
   * page counts twenty. A count taken from the rows in hand would climb as
   * pages loaded, which is the opposite of what this line is for.
   */
  it('counts the account rather than the page', async () => {
    signIn();
    seedGenerations(21);
    renderHistory();

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Showing 20 of 21 resumes'),
    );
  });

  it('has no accessibility violations', async () => {
    signIn();
    seedGenerations(2);
    const { container } = renderHistory();

    await screen.findAllByRole('listitem');
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * `B-066`: cursor, not offset. The list grows from the top, so a second page
 * taken by offset after a new generation landed would repeat one row and hide
 * another.
 */
describe('walking back through the history', () => {
  it('asks for the next page with the cursor the server gave', async () => {
    signIn();
    seedGenerations(21);
    renderHistory();

    // The server's default page is twenty.
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(20));

    await userEvent.click(screen.getByRole('button', { name: en.History.more }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(21));
    expect(asked).toHaveLength(2);

    const second = new URL(asked[1]!).searchParams;
    expect(second.get('cursor')).toBeTruthy();
    // Nothing here reads the value, and nothing invents an offset either.
    expect(second.get('offset')).toBeNull();
  });

  /**
   * The absence of `nextCursor` is the end of the history. Waiting for an
   * empty page would leave a button that has nothing left to fetch.
   */
  it('stops offering more when the server sends no cursor', async () => {
    signIn();
    seedGenerations(3);
    renderHistory();

    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', { name: en.History.more })).not.toBeInTheDocument();
  });
});
