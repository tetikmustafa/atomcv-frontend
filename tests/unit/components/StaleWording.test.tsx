import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { listAtoms, type Atom } from '@/lib/api/endpoints/profile';
import { profileKeys } from '@/lib/api/queryKeys';
import { server } from '@/mocks/node';
import en from '@/messages/en.json';

/**
 * `atom-2` is the fixture's two-wording atom, and its Turkish wording is
 * § 32.2's third row: the source moved on **and** the person wrote this one.
 */
async function renderEditor() {
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

  return { client, ...render(<AtomEditor atomId="atom-2" />, { wrapper: Wrapper }) };
}

const openTurkish = () => userEvent.click(screen.getByRole('tab', { name: /Turkish/ }));

/** Every write the screen made, so "sends nothing" can be asserted. */
let writes: string[] = [];

function record({ request }: { request: Request }) {
  if (request.method === 'PATCH' && request.url.includes('/variants/')) writes.push(request.url);
}

beforeEach(() => {
  writes = [];
  server.events.on('request:start', record);
});

afterEach(() => server.events.removeListener('request:start', record));

describe('a wording whose source has moved on', () => {
  /**
   * The first row of § 32.2's table: up to date, so nothing is said. The
   * editor opens on the primary, which here is the English wording.
   *
   * The second row — stale and nobody's — has no fixture of its own, because
   * it is what the third row *becomes*: the last test below arrives at it by
   * pressing the button, which is the only way a reader reaches it too.
   */
  it('says nothing about a wording that is up to date', async () => {
    await renderEditor();

    expect(screen.queryByTestId('stale-refreshing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stale-yours')).not.toBeInTheDocument();
  });

  it('asks rather than acts when the person wrote it themselves', async () => {
    await renderEditor();
    await openTurkish();

    const notice = screen.getByTestId('stale-yours');
    expect(notice).toHaveTextContent('you wrote this one yourself');
    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.textContent)
        .filter(
          (label) =>
            label === en.Editor.variants.staleRegenerate ||
            label === en.Editor.variants.staleKeepMine,
        ),
    ).toHaveLength(2);
  });

  /**
   * A wording becomes yours by writing words, never by claiming it — so the
   * only value this button can send is `false`, and the server refuses the
   * other one.
   */
  it('hands the wording back with the one value the server accepts', async () => {
    const bodies: Promise<string>[] = [];
    const capture = ({ request }: { request: Request }) => {
      if (request.method === 'PATCH' && request.url.includes('/variants/')) {
        bodies.push(request.clone().text());
      }
    };
    server.events.on('request:start', capture);

    try {
      await renderEditor();
      await openTurkish();
      await userEvent.click(
        screen.getByRole('button', { name: en.Editor.variants.staleRegenerate }),
      );

      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(JSON.parse(await bodies[0]!)).toEqual({ userEdited: false });
    } finally {
      server.events.removeListener('request:start', capture);
    }
  });

  /**
   * And the row **stays stale** afterwards: the regeneration is a background
   * job, so what comes next is "being rewritten" rather than a finished
   * sentence. Skipping that state is what a mock clearing `stale` would do.
   */
  it('becomes the other notice rather than disappearing', async () => {
    const { client } = await renderEditor();
    await openTurkish();
    await userEvent.click(screen.getByRole('button', { name: en.Editor.variants.staleRegenerate }));

    expect(await screen.findByTestId('stale-refreshing')).toBeInTheDocument();
    expect(screen.queryByTestId('stale-yours')).not.toBeInTheDocument();

    const variant = client
      .getQueryData<Atom>(profileKeys.atom('atom-2'))
      ?.variants?.find((candidate) => candidate.id === 'variant-2-tr');
    expect(variant).toMatchObject({ stale: true, userEdited: false });
  });

  /**
   * "Keep mine" asks the server nothing. The reader is declining, and
   * declining is not a request — the wording stays stale and the tab still
   * says so.
   */
  it('sends nothing at all when the reader keeps what they wrote', async () => {
    await renderEditor();
    await openTurkish();

    await userEvent.click(screen.getByRole('button', { name: en.Editor.variants.staleKeepMine }));

    expect(screen.queryByTestId('stale-yours')).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
    // The badge is about the row, not about the notice, and the row really is
    // still out of date.
    expect(screen.getByRole('tab', { name: /Turkish/ })).toHaveTextContent(
      en.Editor.variants.staleBadge,
    );
  });
});
