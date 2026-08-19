import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { listAtoms, type Atom } from '@/lib/api/endpoints/profile';
import { profileKeys } from '@/lib/api/queryKeys';
import en from '@/messages/en.json';
import { server } from '@/mocks/node';

async function renderEditor(atomId: string, locale: 'en' | 'tr' = 'en') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const atoms = await listAtoms();
  for (const atom of atoms) client.setQueryData(profileKeys.atom(atom.id!), atom);
  client.setQueryData(profileKeys.atoms(), atoms);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return { ...render(<AtomEditor atomId={atomId} />, { wrapper: Wrapper }), client };
}

const cached = (client: QueryClient, id: string) => client.getQueryData<Atom>(profileKeys.atom(id));

describe('an atom with one wording', () => {
  /** Tabs around a single item are chrome around nothing. */
  it('shows no tab strip at all', async () => {
    await renderEditor('atom-1');

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Text')).toBeInTheDocument();
  });
});

describe('an atom with several wordings', () => {
  it('names each one by language, in the reader’s language', async () => {
    await renderEditor('atom-2');

    const tabs = screen.getByRole('tablist', { name: 'Wordings' });
    expect(within(tabs).getByRole('tab', { name: /English/ })).toBeInTheDocument();
    // Rule 9: a code is not a name, and the name belongs in the reader's
    // language — "Turkish" here, not "Türkçe".
    expect(within(tabs).getByRole('tab', { name: /Turkish/ })).toBeInTheDocument();
  });

  it('opens on the primary, because that is the one a CV uses', async () => {
    await renderEditor('atom-2');

    const selected = screen.getByRole('tab', { selected: true });
    expect(selected).toHaveTextContent(/English/);
    expect(selected).toHaveTextContent('default');
  });

  /**
   * Bölüm 37.6. A stale wording is the reason a CV goes out with the wrong
   * sentence in it, so it is said in words rather than shown as a colour
   * (rule 6).
   */
  it('says which wording is out of date, in text', async () => {
    const user = userEvent.setup();
    await renderEditor('atom-2');

    expect(screen.getByRole('tab', { name: /Turkish/ })).toHaveTextContent('out of date');

    await user.click(screen.getByRole('tab', { name: /Turkish/ }));

    expect(screen.getByText(/wording this was based on has changed/)).toBeInTheDocument();
  });

  /**
   * ⚠️ Stage 1 publishes no endpoint that regenerates a stale wording, and
   * Bölüm 37.6 draws a button for it. A control that cannot work is worse
   * than none on a screen already telling the user something is wrong, so the
   * badge stops at saying what is true. Raised in DOC-SYNC-REQUEST.md.
   */
  it('offers no regenerate button, because nothing could answer it', async () => {
    const user = userEvent.setup();
    await renderEditor('atom-2');

    await user.click(screen.getByRole('tab', { name: /Turkish/ }));

    expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument();
  });

  it('edits the wording that is selected, not the primary', async () => {
    const user = userEvent.setup();
    const { client } = await renderEditor('atom-2');

    await user.click(screen.getByRole('tab', { name: /Turkish/ }));

    const field = screen.getByLabelText('Text');
    expect(field).toHaveValue('ETL hatları kurdum');

    await user.clear(field);
    await user.type(field, 'ETL hatlarını kurdum');
    await user.tab();

    await waitFor(() => {
      const variants = cached(client, 'atom-2')?.variants ?? [];
      expect(variants.find((v) => v.id === 'variant-2-tr')?.plainText).toBe('ETL hatlarını kurdum');
      // The English wording is untouched: they version independently.
      expect(variants.find((v) => v.id === 'variant-2')?.version).toBe(0);
    });
  });

  /**
   * Promotion is not a local change: the server demotes the old primary and
   * re-sorts, while the response carries only the wording that was written.
   * Merging it would leave two wordings both claiming to be the default.
   */
  it('promotes a wording and the other stops being the default', async () => {
    const user = userEvent.setup();
    const { client } = await renderEditor('atom-2');

    await user.click(screen.getByRole('tab', { name: /Turkish/ }));
    await user.click(screen.getByRole('button', { name: 'Use this one by default' }));

    await waitFor(() => {
      const variants = cached(client, 'atom-2')?.variants ?? [];
      expect(variants.find((v) => v.id === 'variant-2-tr')?.primary).toBe(true);
      expect(variants.find((v) => v.id === 'variant-2')?.primary).toBe(false);
    });
  });

  /**
   * A promote carries `primary` and nothing else.
   *
   * It used to resend the whole wording, because `content` was required on
   * this endpoint even for a write that had nothing to do with content — and
   * that request cleared the user's `tone` every time (handoff B-028). The
   * server no longer requires it, so sending it again would be re-creating a
   * bug that has already been fixed once.
   */
  it('sends only what changes, so a promote cannot clear the tone', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;

    server.use(
      http.patch('*/api/v1/profile/atoms/:id/variants/:variantId', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'variant-2-tr', primary: true, version: 1 });
      }),
    );

    await renderEditor('atom-2');
    await user.click(screen.getByRole('tab', { name: /Turkish/ }));
    await user.click(screen.getByRole('button', { name: 'Use this one by default' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({ primary: true });
    expect(body).not.toHaveProperty('content');
    expect(body).not.toHaveProperty('tone');
  });

  it('offers no promote control on the wording that is already the default', async () => {
    await renderEditor('atom-2');

    expect(
      screen.queryByRole('button', { name: 'Use this one by default' }),
    ).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = await renderEditor('atom-2');
    expect(await axe(container)).toHaveNoViolations();
  });
});
