import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { listAtoms, type Atom } from '@/lib/api/endpoints/profile';
import { profileKeys } from '@/lib/api/queryKeys';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import { useAnnouncerStore } from '@/stores/announcerStore';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

/** Every tag request that went out, so "no `If-Match`" can be asserted. */
let calls: { method: string; url: string; ifMatch: string | null }[] = [];

function record({ request }: { request: Request }) {
  if (request.url.includes('/tags')) {
    calls.push({
      method: request.method,
      url: request.url,
      ifMatch: request.headers.get('If-Match'),
    });
  }
}

beforeEach(() => {
  calls = [];
  useAnnouncerStore.getState().clear();
  server.events.on('request:start', record);
  return () => server.events.removeListener('request:start', record);
});

/**
 * `atom-2` is the fixture's tagged atom, and it wears one of each source —
 * which is the state this file is mostly about.
 */
async function renderEditor(atomId = 'atom-2') {
  signIn();

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const atoms = await listAtoms();
  for (const atom of atoms) client.setQueryData(profileKeys.atom(atom.id!), atom);
  client.setQueryData(profileKeys.atoms(), atoms);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  const utils = render(<AtomEditor atomId={atomId} />, { wrapper: Wrapper });
  await screen.findByLabelText(en.Editor.atomTags.label);

  return { ...utils, client };
}

const cached = (client: QueryClient, id = 'atom-2') =>
  client.getQueryData<Atom>(profileKeys.atom(id));

const field = () => screen.getByLabelText(en.Editor.atomTags.label);

/**
 * The labels an atom wears (`B-103`).
 *
 * The item is blunt about what was wrong: nothing was writing to `tags` or
 * `atom_tags` at all, so Faz B's tag overlap — **a quarter of the raw
 * score** — was structurally zero for every atom against every posting. What
 * is worth pinning here is not that chips render; it is the three things a
 * client gets wrong by assuming the opposite.
 */
describe('the labels on an atom', () => {
  it('shows the ones it already wears', async () => {
    await renderEditor();

    expect(screen.getByText('data-engineering')).toBeInTheDocument();
    expect(screen.getByText('etl')).toBeInTheDocument();
  });

  /**
   * An `auto` tag is the extraction's guess about somebody's work; a `user`
   * tag is their own decision. Drawing them alike would make a guess look
   * like a choice, and a reader who cannot tell them apart has no reason to
   * correct either.
   *
   * Said in words as well as by the border (rule 6) — the words are what a
   * reader who cannot see the border gets.
   */
  it('tells a suggestion apart from a decision, in words', async () => {
    const { container } = await renderEditor();

    const suggested = container.querySelector('[data-source="auto"]')!;
    const chosen = container.querySelector('[data-source="user"]')!;

    expect(within(suggested as HTMLElement).getByText(/Suggested when your CV was read/));
    expect(within(chosen as HTMLElement).getByText(/Added by you/));
  });

  /**
   * **No `If-Match`, and this is the assertion that says so.** Every other
   * write in the editor carries one; a tag is a row of its own and the atom
   * is untouched, so there is no version of the atom for a precondition to be
   * about — and sending one would make two people tagging one atom a conflict
   * when the right outcome is both tags.
   */
  it('sends no precondition, because the atom is not being changed', async () => {
    const user = userEvent.setup();
    const { client } = await renderEditor();
    const before = cached(client)?.version;

    await user.type(field(), 'observability{Enter}');

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: 'POST', ifMatch: null });
    // And the atom's own version has not moved, which is the other half of
    // the same claim.
    expect(cached(client)?.version).toBe(before);
  });

  /**
   * The label is stored trimmed and lowercased, because that is the form the
   * scorer compares. What is drawn is what came back — echoing the input
   * would put a word on screen that is not the one being scored.
   */
  it('draws the stored label rather than what was typed', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.type(field(), '  Platform-Engineering  {Enter}');

    expect(await screen.findByText('platform-engineering')).toBeInTheDocument();
    expect(screen.queryByText('Platform-Engineering')).toBeNull();
  });

  /** And it says so out loud, because a chip appearing is only a shape. */
  it('announces what was added', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.type(field(), 'observability{Enter}');

    await waitFor(() =>
      expect(useAnnouncerStore.getState().announcement?.message).toBe(
        en.Editor.atomTags.announceAdded.replace('{label}', 'observability'),
      ),
    );
  });

  /**
   * Typing a label the atom already wears sends nothing. The endpoint is
   * idempotent so it would be harmless — but it is a round trip for nothing,
   * and a moment where the field looks like it did something.
   *
   * Compared lowercased for the same reason the server stores it that way,
   * and with an explicit `en` locale: Turkish folds `I` to a dotless `ı`
   * (rule 11), so `ETL` would not match `etl` under the reader's locale.
   */
  it('asks for nothing when the atom already wears that label', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.type(field(), 'ETL{Enter}');

    expect(calls).toHaveLength(0);
    expect(screen.getAllByText('etl')).toHaveLength(1);
  });

  it('takes one off, by its own id', async () => {
    const user = userEvent.setup();
    const { client } = await renderEditor();

    await user.click(
      screen.getByRole('button', { name: en.Editor.atomTags.remove.replace('{label}', 'etl') }),
    );

    await waitFor(() => expect(screen.queryByText('etl')).toBeNull());
    // Removed by id rather than by label: one word can be stored once and
    // worn by many atoms, and the row this deletes is the join.
    expect(calls[0]?.url).toContain('/tags/tag-user-1');
    expect(cached(client)?.tags?.map((tag) => tag.id)).toEqual(['tag-auto-1']);
  });

  it('has no accessibility violations', async () => {
    const { container } = await renderEditor();
    expect(await axe(container)).toHaveNoViolations();
  });
});
