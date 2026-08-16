import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SectionList } from '@/components/profile/SectionList';
import { listAtoms } from '@/lib/api/endpoints/profile';
import { useEditorUiStore } from '@/stores/editorUiStore';
import en from '@/messages/en.json';

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
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  });

  it('names each atom by its own words in the move controls', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));

    expect(
      screen.getByRole('button', { name: /Move Engineered ETL pipelines up/ }),
    ).toBeInTheDocument();
  });

  /**
   * The reorder endpoint takes the complete group; a partial list is a 400
   * (D.9 · 19), and the mock refuses one for the same reason the server does.
   * So this asserts the server actually accepted it, not merely that a
   * request was made.
   */
  it('reorders atoms and the new order survives a refetch', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Experience' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: /Move Engineered ETL pipelines up/ }));

    await waitFor(async () => {
      const stored = await listAtoms({ sectionId: 'sec-experience' });
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
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));

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
