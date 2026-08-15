import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { listAtoms, patchAtom, type Atom } from '@/lib/api/endpoints/profile';
import { profileKeys } from '@/lib/api/queryKeys';
import en from '@/messages/en.json';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/**
 * Seeds the cache the way `useAtoms` does. `useAtom` has no request behind it
 * by design — the API has no single-atom endpoint — so a test that skipped
 * this would be testing the diagnostic throw rather than the editor.
 */
async function seeded(client: QueryClient) {
  const atoms = await listAtoms();
  for (const atom of atoms) client.setQueryData(profileKeys.atom(atom.id!), atom);
  client.setQueryData(profileKeys.atoms(), atoms);
  return atoms;
}

async function renderEditor(atomId = 'atom-1') {
  const client = makeClient();
  await seeded(client);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  const utils = render(<AtomEditor atomId={atomId} />, { wrapper: Wrapper });
  return { ...utils, client };
}

const cached = (client: QueryClient, id = 'atom-1') =>
  client.getQueryData<Atom>(profileKeys.atom(id));

describe('the atom editor', () => {
  it('shows the stored wording with its marks intact', async () => {
    await renderEditor();

    const article = screen.getByRole('article');
    expect(article).toHaveTextContent('Built a query monitor that reached 900 stars');
    // The metric is marked in the fixture, and the marks are what a template
    // reads — losing them on display would hide that they are there at all.
    expect(article.querySelector('[data-mark="metric"]')).toHaveTextContent('900 stars');
  });

  /**
   * A toggle is the whole decision, so it saves at once (Bölüm 37.1) and the
   * value moves before the round trip (37.2). The version in the cache is
   * what proves the write actually landed rather than only being optimistic.
   */
  it('saves a toggle immediately and takes the new version from the response', async () => {
    const user = userEvent.setup();
    const { client } = await renderEditor();

    expect(cached(client)?.version).toBe(0);

    await user.click(screen.getByRole('switch', { name: /always include/i }));

    await waitFor(() => expect(cached(client)?.alwaysInclude).toBe(true));
    await waitFor(() => expect(cached(client)?.version).toBe(1));
  });

  it('announces that it saved, rather than only colouring a dot', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.click(screen.getByRole('switch', { name: /never reword/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('status').some((r) => r.textContent === 'Saved')).toBe(true);
    });
  });

  /**
   * Rule 5. Radix carries this for the slider, and it is worth an assertion
   * because a hand-rolled drag surface is the usual way it gets lost.
   */
  it('lets the importance slider be moved from the keyboard', async () => {
    const user = userEvent.setup();
    const { client } = await renderEditor();

    const slider = screen.getByRole('slider', { name: 'Importance' });
    slider.focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => expect(cached(client)?.importance).toBeCloseTo(0.65, 2));
  });

  /**
   * P8: the plain-text field cannot represent marks, so saving through it
   * drops them. That is allowed; doing it without saying so is not — and the
   * warning has to arrive while the edit can still be abandoned.
   */
  it('warns before a text edit drops the marks on it', async () => {
    const user = userEvent.setup();
    await renderEditor();

    expect(screen.queryByText(/drop the highlighting/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Text'), '!');

    expect(screen.getByText(/drop the highlighting/i)).toBeInTheDocument();
  });

  it('says nothing about marks on an atom that has none', async () => {
    const user = userEvent.setup();
    await renderEditor('atom-2');

    await user.type(screen.getByLabelText('Text'), '!');

    expect(screen.queryByText(/drop the highlighting/i)).not.toBeInTheDocument();
  });

  /**
   * The two halves version independently (D.9 · 17), so they save through
   * different endpoints and must not be wired to one another.
   */
  it('saves wording through the variant, leaving the atom’s own version alone', async () => {
    const user = userEvent.setup();
    const { client } = await renderEditor();

    const field = screen.getByLabelText('Text');
    await user.clear(field);
    await user.type(field, 'Rewritten');
    await user.tab();

    await waitFor(() => expect(cached(client)?.variants?.[0]?.plainText).toBe('Rewritten'));
    expect(cached(client)?.variants?.[0]?.version).toBe(1);
    expect(cached(client)?.version).toBe(0);
  });

  /**
   * Rule 7 reaching the editor: another writer moves the server on, this
   * client's cached version is stale, and the refusal has to arrive as a
   * choice rather than as a silent no-op.
   */
  it('surfaces a conflict with both ways out and the server’s resolution', async () => {
    const user = userEvent.setup();
    const { client } = await renderEditor();

    // Someone else writes. The cache does not hear about it.
    await patchAtom('atom-1', { importance: 0.75 }, 0);

    await user.click(screen.getByRole('switch', { name: /always include/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Use the other version' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('changed somewhere else');

    // Rolled back to exactly what was there, version included, so the next
    // attempt is built on something real.
    expect(cached(client)?.alwaysInclude).toBe(false);
    expect(cached(client)?.version).toBe(0);
  });

  it('has no accessibility violations', async () => {
    const { container } = await renderEditor();
    expect(await axe(container)).toHaveNoViolations();
  });
});
