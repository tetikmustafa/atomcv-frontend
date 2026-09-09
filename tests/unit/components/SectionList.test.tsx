import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionList } from '@/components/profile/SectionList';
import { listAtoms } from '@/lib/api/endpoints/profile';
import { useEditorUiStore } from '@/stores/editorUiStore';
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

  return { ...render(<SectionList />, { wrapper: Wrapper }), client };
}

beforeEach(() => useEditorUiStore.getState().reset());

describe('the section list', () => {
  /** Bölüm 31.6: two hundred atoms at once overwhelms, so nothing starts open. */
  it('starts collapsed and loads a section’s atoms only when opened', async () => {
    const user = userEvent.setup();
    renderSections();

    const toggle = await screen.findByRole('button', { name: 'Experience' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  });

  it('names each atom by its own words in the move controls', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));

    expect(
      screen.getByRole('button', { name: /Move Engineered ETL pipelines up/ }),
    ).toBeInTheDocument();
  });

  /**
   * The reorder endpoint takes the complete group; a partial list is a 400
   * (`spec/08-api.md`), and the mock refuses one for the same reason the server does.
   * So this asserts the server actually accepted it, not merely that a
   * request was made.
   */
  it('reorders atoms and the new order survives a refetch', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: /Move Engineered ETL pipelines up/ }));

    // Asserted on the entry rather than the section: the section's list is
    // ordered by `displayOrder` across every entry, so the other job's bullet
    // sits in the middle of it and says nothing about whether this move landed.
    await waitFor(async () => {
      const stored = await listAtoms({ entryId: 'entry-trendyol' });
      expect(stored.map((atom) => atom.id)).toEqual(['atom-2', 'atom-1']);
    });
  });

  /**
   * P8, as a user action rather than a unit of `useAutosave`.
   *
   * Collapsing a section unmounts every editor under it. If the cleanup
   * cancelled instead of flushing, a sentence finished a moment ago would be
   * gone with no error and nothing on screen to suggest it ever existed.
   */
  it('keeps an edit that was still pending when the section was collapsed', async () => {
    const user = userEvent.setup();
    renderSections();

    const toggle = await screen.findByRole('button', { name: 'Experience' });
    await user.click(toggle);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));

    const first = screen.getAllByRole('article')[0]!;
    const field = within(first).getByLabelText('Text');

    await user.clear(field);
    await user.type(field, 'Half a thought');

    // Collapsed through the store rather than by clicking the toggle.
    // Clicking blurs the textarea first, and blur flushes — which would make
    // this pass even with no unmount flush at all, testing the wrong half.
    act(() => useEditorUiStore.getState().toggleSection('sec-experience'));

    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await waitFor(async () => {
      const stored = await listAtoms({ sectionId: 'sec-experience' });
      const edited = stored.find((atom) => atom.id === 'atom-1');
      expect(edited?.variants?.[0]?.plainText).toBe('Half a thought');
    });
  });
});

/**
 * The three-level shape: section → entry → atoms.
 *
 * This is the half the editor was missing. `displayOrder` on an atom restarts
 * inside each entry, so the section's own list interleaves them — the mock
 * reproduces that, because the running server does. Rendering it flat put one
 * job's bullets between another's with no employer named anywhere, and the old
 * fixture (two atoms, no entries) could not show it.
 */
describe('entries inside a section', () => {
  it('groups each job’s bullets under its own heading, in order', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));

    const trendyol = await screen.findByRole('group', { name: /Senior Backend Engineer/ });
    const getir = screen.getByRole('group', { name: /^Backend Engineer/ });

    // Grouped, not interleaved: the flat response is atom-1, atom-3, atom-2.
    // Read off the fields rather than the text, which also appears in each
    // atom's rich-text preview — and asserted as a list, because the order
    // inside a group is the half that was broken.
    const wording = (group: HTMLElement) =>
      within(group)
        .getAllByLabelText('Text')
        .map((field) => (field as HTMLTextAreaElement).value);

    expect(wording(trendyol)).toEqual([
      'Built a query monitor that reached 900 stars',
      'Engineered ETL pipelines',
    ]);
    expect(wording(getir)).toEqual(['Rewrote the courier assignment']);
  });

  it('says where and when, through Intl rather than by slicing the string', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));

    const getir = await screen.findByRole('group', { name: /^Backend Engineer/ });
    // `2019-08-01` is the first of the month: formatted in any zone behind UTC
    // it would slip back to July, which is the whole reason the formatter
    // works in UTC.
    expect(within(getir).getByText(/Getir · Istanbul · Aug 2019 – Mar 2022/)).toBeInTheDocument();
  });

  /**
   * A missing `endDate` means the job is current (`spec/08-api.md`). Rule 6: it
   * is said in words, because "Apr 2022 –" trailing into nothing reads as a
   * truncated string rather than as "still there".
   */
  it('says a job with no end date is the current one, in words', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));

    const trendyol = await screen.findByRole('group', { name: /Senior Backend Engineer/ });
    expect(within(trendyol).getByText(/Apr 2022 – present/)).toBeInTheDocument();
  });

  /**
   * The other shape. A skills section has no entries at all and its atoms hang
   * straight off it, so there is nothing to head them with — and inventing a
   * heading would be worse than none.
   */
  it('renders a section’s own atoms with no entry heading at all', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Skills' }));

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    // A section is a region; an entry is a group. There are no entries here.
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  /**
   * Reordering addresses a group, not a section: the endpoint takes the
   * complete list of one `entryId`, and a partial one is a 400. Sending the
   * section's whole list for a move inside one job is exactly that mistake, so
   * this asserts the server accepted it rather than that a request went out.
   */
  it('reorders within one entry and leaves the other alone', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await screen.findByRole('group', { name: /Senior Backend Engineer/ });

    await user.click(screen.getByRole('button', { name: /Move Engineered ETL pipelines up/ }));

    await waitFor(async () => {
      expect((await listAtoms({ entryId: 'entry-trendyol' })).map((atom) => atom.id)).toEqual([
        'atom-2',
        'atom-1',
      ]);
    });

    expect((await listAtoms({ entryId: 'entry-getir' })).map((atom) => atom.id)).toEqual([
      'atom-3',
    ]);
  });

  /**
   * Axe cannot tell you the outline is *wrong*, only that it is well-formed —
   * so the heading levels are asserted outright. The section's title is the
   * `h2` and an entry's is the `h3` under it; flattening them would still pass
   * every automated check while leaving a screen reader with no way to tell
   * which job a bullet belongs to.
   */
  it('nests the entry headings under the section’s, and has no violations', async () => {
    const user = userEvent.setup();
    const { container } = renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await screen.findByRole('group', { name: /Senior Backend Engineer/ });

    expect(screen.getByRole('heading', { level: 2, name: 'Experience' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Senior Backend Engineer', 'Backend Engineer']);

    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * § 20.2, and the reason it changed: selection used to work atom by atom, so
 * an entry with no bullets under it was not a candidate at all — a degree
 * could not reach a generated CV by any route. The alternative, making people
 * write a bullet for every entry, is the padding this product exists to
 * refuse.
 *
 * What that asks of the editor is that it stop treating such an entry as
 * unfinished (`B-061`), which is mostly a matter of what it does **not** do.
 */
describe('an entry with no bullets under it', () => {
  async function openEducation() {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Education' }));
    return user;
  }

  it('is drawn like any other, with its heading intact', async () => {
    await openEducation();

    expect(await screen.findByText('BSc Computer Engineering')).toBeInTheDocument();
    expect(screen.getByText(/Yıldız Technical University/)).toBeInTheDocument();
  });

  /**
   * Not a warning, not a nudge, and above all not "this will not appear in
   * your CV" — which is the sentence `B-061` asks to be removed and which is
   * now simply false.
   */
  it('says it is empty without saying it is unfinished', async () => {
    await openEducation();

    const note = await screen.findByText(/No bullets under this one/);
    expect(note).toBeInTheDocument();
    expect(note).not.toHaveAttribute('role', 'alert');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /** An option rather than an obligation: the way in is still there. */
  it('still offers a bullet to anyone who wants one', async () => {
    await openEducation();

    // The field, not the button: the button reads "Add" and is disabled until
    // something is typed, which is the ordinary empty-form state rather than
    // anything to do with this entry.
    expect(await screen.findByLabelText('Add a bullet')).toBeInTheDocument();
  });
});
