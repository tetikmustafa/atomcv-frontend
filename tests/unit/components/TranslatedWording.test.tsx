import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { getSession } from '@/lib/api/endpoints/auth';
import { listAtoms } from '@/lib/api/endpoints/profile';
import { profileKeys, sessionKeys } from '@/lib/api/queryKeys';
import { signIn } from '@/mocks/sessionFixture';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

async function renderEditor(atomId: string) {
  signIn();

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await client.prefetchQuery({ queryKey: sessionKeys.current(), queryFn: getSession });

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

  return render(<AtomEditor atomId={atomId} />, { wrapper: Wrapper });
}

const openTurkish = () => userEvent.click(screen.getByRole('tab', { name: /Turkish/ }));

/**
 * A wording nobody in this profile wrote (`B-107`, § 32.5).
 *
 * `auto` follows the posting now: missing wordings are translated between Faz
 * B and Faz C and written **back to the profile**, so rows appear in this
 * editor that the person did not type.
 */
describe('a wording that was translated rather than written', () => {
  it('says so, on a wording that is otherwise perfectly up to date', async () => {
    await renderEditor('atom-3');
    await openTurkish();

    expect(screen.getByTestId('translated-wording')).toHaveTextContent(
      en.Editor.variants.translated,
    );
    // And it is **not** the staleness notice: the source has not moved, and
    // the two are separate facts about the same row.
    expect(screen.queryByTestId('stale-refreshing')).toBeNull();
    expect(screen.queryByTestId('stale-yours')).toBeNull();
  });

  it('says nothing about a wording the person wrote', async () => {
    await renderEditor('atom-2');
    await openTurkish();

    // `atom-2`'s Turkish wording carries the other pair -- stale and edited --
    // so this asserts the two notices do not stand in for each other.
    expect(screen.queryByTestId('translated-wording')).toBeNull();
    expect(screen.getByTestId('stale-yours')).toBeInTheDocument();
  });

  /**
   * The note ends the moment the reading happens, and it ends because the
   * **server** records authorship rather than because this screen keeps a
   * flag. Nothing here is dismissible: a dismissal would end the note without
   * ending the fact.
   */
  it('stops once the reader has made the wording theirs', async () => {
    const user = userEvent.setup();
    await renderEditor('atom-3');
    await openTurkish();

    expect(screen.getByTestId('translated-wording')).toBeInTheDocument();
    // No dismiss control: the only way out is through the text.
    expect(screen.queryByRole('button', { name: /dismiss|keep/i })).toBeNull();

    const field = screen.getByLabelText('Text');
    await user.clear(field);
    await user.type(field, 'Kurye atamasını baştan yazdım');
    await user.tab();

    await waitFor(() => expect(screen.queryByTestId('translated-wording')).toBeNull(), {
      timeout: 4000,
    });
  });
});
