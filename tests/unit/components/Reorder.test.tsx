import type { ReactNode } from 'react';
import { delay, http } from 'msw';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionList } from '@/components/profile/SectionList';
import { profileKeys } from '@/lib/api/queryKeys';
import type { Entry, Section } from '@/lib/api/endpoints/profile';
import { useEditorUiStore } from '@/stores/editorUiStore';
import { server } from '@/mocks/node';
import en from '@/messages/en.json';

/*
  next-intl's client navigation is imported for one thing here: the editor
  carries out the `sign_up` the server offers when an anonymous session meets
  one of § 35.7.2's limits (`B-081`). It has to be mocked rather than left
  alone — its ESM entry does not resolve under Vitest, and the App Router it
  reaches for does not exist in jsdom. Nothing in this file asserts on it;
  `useAccountResolution.test` is where that resolution is checked.
*/
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

function renderSections() {
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

  return { user: userEvent.setup(), client, ...render(<SectionList />, { wrapper: Wrapper }) };
}

/** The bodies each reorder endpoint received, so scope is assertable. */
function recordReorders() {
  const sent: { path: string; body: unknown }[] = [];

  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && path.endsWith('/reorder')) {
      sent.push({ path, body: await request.clone().json() });
    }
  });

  return sent;
}

beforeEach(() => useEditorUiStore.getState().reset());

describe('reordering sections', () => {
  /**
   * Rule 5. The drag sensor is a mode you have to know about and enter; the
   * move buttons are the same operation without it, and the only one a switch
   * device or voice control can reach.
   */
  it('moves a section with the buttons alone, and sends the complete list', async () => {
    const sent = recordReorders();
    const { user } = renderSections();

    await screen.findByRole('button', { name: 'Experience' });

    await user.click(screen.getByRole('button', { name: 'Move Skills up' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.path).toBe('/api/v1/profile/sections/reorder');
    // The server takes every id in the new order; a partial list is a 400
    // naming `ids`, measured.
    expect(sent[0]!.body).toEqual({ ids: ['sec-skills', 'sec-experience', 'sec-education'] });
  });

  /**
   * ⚠️ The trap this endpoint carries, measured against the running backend:
   * a reorder is a write and the server versions every row it moves. Four
   * sections at 0, swap two, and they come back `[1, 1, 0, 0]`.
   *
   * `useDeleteSection` builds its `If-Match` from exactly this cached number.
   * Leaving it behind is a 412 on the next delete — the same failure the
   * variant endpoint produced before `B-034`, and the reason the response is
   * written through rather than merely invalidated.
   */
  it('takes the new versions from the response, not from a later refetch', async () => {
    const { user, client } = renderSections();
    await screen.findByRole('button', { name: 'Experience' });

    const before = client.getQueryData<Section[]>(profileKeys.sections());
    expect(before?.map((section) => section.version)).toEqual([0, 0, 0]);

    await user.click(screen.getByRole('button', { name: 'Move Skills up' }));

    await waitFor(() => {
      const after = client.getQueryData<Section[]>(profileKeys.sections());
      expect(after?.map((section) => section.id)).toEqual([
        'sec-skills',
        'sec-experience',
        'sec-education',
      ]);
      /*
        Two moved and one did not, and the third number is the half this
        assertion could not make before. With two sections a swap moved both,
        so "only the rows that moved are versioned" was stated in the comment
        and checked by nothing; the fixture's third section — added for
        `B-061` — is what makes the claim testable.
      */
      expect(after?.map((section) => section.version)).toEqual([1, 1, 0]);
    });
  });

  /**
   * The list must not snap back for the length of a round trip — that reads as
   * a failed drop, which is the whole reason this is optimistic.
   */
  it('shows the new order before the server answers', async () => {
    const { user, client } = renderSections();
    await screen.findByRole('button', { name: 'Experience' });

    await user.click(screen.getByRole('button', { name: 'Move Skills up' }));

    // Read synchronously after the click: the optimistic write has run, the
    // response has not landed, so the versions are still the old ones.
    const optimistic = client.getQueryData<Section[]>(profileKeys.sections());
    expect(optimistic?.map((section) => section.id)).toEqual([
      'sec-skills',
      'sec-experience',
      'sec-education',
    ]);
  });
});

describe('reordering entries', () => {
  it('moves a job within its section', async () => {
    const sent = recordReorders();
    const { user } = renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: 'Move Backend Engineer up' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.path).toBe('/api/v1/profile/entries/reorder');
    // `sectionId` travels with the ids, and the server refuses one that
    // disagrees with them — a 400 naming `ids`, measured.
    expect(sent[0]!.body).toEqual({
      sectionId: 'sec-experience',
      ids: ['entry-getir', 'entry-trendyol'],
    });
  });

  /**
   * ⚠️ Same trap as the sections, demonstrated directly against the running
   * server: reorder two entries, then patch one with the version read before,
   * and it answers 412.
   *
   * The response covers only that section's group, so it is merged by id
   * rather than written over the list — an unfiltered cache holds the other
   * sections' entries too.
   */
  it('refreshes the versions of the entries it moved', async () => {
    const { user, client } = renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));

    const key = profileKeys.entries('sec-experience');
    expect(client.getQueryData<Entry[]>(key)?.map((entry) => entry.version)).toEqual([0, 0]);

    // Hold the refetch that `onSettled` starts. It re-seeds every version from
    // the server and so repairs a missing merge — without this the assertion
    // passes either way and proves nothing, which is exactly how the same bug
    // slipped through at the variant endpoint.
    server.use(http.get('*/api/v1/profile/entries', async () => delay('infinite')));

    await user.click(screen.getByRole('button', { name: 'Move Backend Engineer up' }));

    await waitFor(() => {
      const after = client.getQueryData<Entry[]>(key);
      expect(after?.map((entry) => entry.id)).toEqual(['entry-getir', 'entry-trendyol']);
      expect(after?.map((entry) => entry.version)).toEqual([1, 1]);
    });
  });

  /**
   * The bullets under a job are a sortable list of their own, so this is one
   * drag context inside another. What must not happen is a bullet's controls
   * moving the job it sits under, or the reverse.
   */
  it('keeps the bullets’ own reorder separate from the entries’', async () => {
    const sent = recordReorders();
    const { user } = renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: /Move Engineered ETL pipelines up/ }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.path).toBe('/api/v1/profile/atoms/reorder');
    // Scoped to the entry, not to the section: the endpoint takes one group.
    expect(sent[0]!.body).toMatchObject({ sectionId: 'sec-experience', entryId: 'entry-trendyol' });
  });

  /**
   * Nesting the entries in a sortable list must not have cost the section its
   * heading, its collapse control, or the delete beneath it.
   */
  it('leaves each entry’s own controls in place', async () => {
    const { user } = renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));

    const job = screen.getByRole('group', { name: /Senior Backend Engineer/ });
    expect(within(job).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Senior Backend Engineer',
    );
    expect(
      screen.getByRole('button', { name: 'Delete the entry Senior Backend Engineer' }),
    ).toBeInTheDocument();
  });
});
