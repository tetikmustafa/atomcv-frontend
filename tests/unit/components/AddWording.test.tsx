import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { api } from '@/lib/api/client';
import { ApiError, isApiError } from '@/lib/api/errors';
import { listAtoms } from '@/lib/api/endpoints/profile';
import { profileKeys } from '@/lib/api/queryKeys';
import { fixture } from '@/mocks/profileFixture';
import { signIn } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';
import type { Variant } from '@/lib/api/endpoints/profile';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => '/profile',
}));

let client: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en} formats={formats}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

const ATOM_ID = 'atom-1';

/**
 * The editor reads an atom from the per-atom cache, which the collection
 * seeds. Loading the collection the way the product does is what makes the
 * editor renderable at all.
 */
async function mountEditor() {
  const atoms = await listAtoms();
  for (const atom of atoms) client.setQueryData(profileKeys.atom(atom.id!), atom);
  client.setQueryData(profileKeys.atoms(), atoms);

  return render(<AtomEditor atomId={ATOM_ID} />, { wrapper: Wrapper });
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const caught: unknown = await promise.catch((error: unknown) => error);
  if (!isApiError(caught)) throw new Error('expected an ApiError');
  return caught;
}

/**
 * A second wording for an atom (`B-081`'s second item).
 *
 * The endpoint shipped in Stage 1 and nothing ever called it, so
 * `canAddAlternatives` was a capability with no control behind it. What is
 * worth pinning is the part that makes the control honest: nothing is created
 * until somebody has written the sentence.
 */
describe('adding a wording', () => {
  it('is not offered without an account', async () => {
    // The profile has two content languages, so there is one to add — the
    // control is absent because of the capability, not because of the list.
    fixture.profile.enabledLanguages = ['en', 'tr'];

    await mountEditor();

    await screen.findByLabelText(en.Editor.atom.text);
    expect(screen.queryByRole('button', { name: en.Editor.variants.add })).not.toBeInTheDocument();
  });

  /**
   * An empty select is a question with no answers. When every enabled
   * language already has a wording, the control is not drawn at all.
   */
  it('is not offered when every language already has one', async () => {
    signIn();
    fixture.profile.enabledLanguages = ['en'];

    await mountEditor();

    await screen.findByLabelText(en.Editor.atom.text);
    expect(screen.queryByRole('button', { name: en.Editor.variants.add })).not.toBeInTheDocument();
  });

  it('writes the wording before the variant exists, and opens it', async () => {
    signIn();
    fixture.profile.enabledLanguages = ['en', 'tr'];
    const user = userEvent.setup();

    await mountEditor();

    await user.click(await screen.findByRole('button', { name: en.Editor.variants.add }));
    await user.type(screen.getByLabelText(en.Editor.variants.addText), 'Sorgu izleyicisi yazdım');
    await user.click(screen.getByRole('button', { name: en.Editor.variants.addSubmit }));

    await waitFor(() => {
      const atom = fixture.atoms.find((candidate) => candidate.id === ATOM_ID)!;
      expect(atom.variants).toHaveLength(2);
    });

    const added = fixture.atoms
      .find((candidate) => candidate.id === ATOM_ID)!
      .variants!.find((variant: Variant) => variant.language === 'tr')!;

    // Never primary unless asked: a wording somebody has just started writing
    // is not the one a CV should be built from.
    expect(added.primary).toBe(false);
    expect(added.plainText).toBe('Sorgu izleyicisi yazdım');

    // The strip appears, and the new wording is the one on screen — writing
    // something and being left looking at the old one is the failure this
    // callback exists to prevent.
    const strip = await screen.findByRole('tablist', { name: en.Editor.variants.listLabel });
    expect(strip).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Turkish/ })).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('has no accessibility violations while open', async () => {
    signIn();
    fixture.profile.enabledLanguages = ['en', 'tr'];
    const user = userEvent.setup();

    const { container } = await mountEditor();

    await user.click(await screen.findByRole('button', { name: en.Editor.variants.add }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * The rule the endpoint states itself: one wording per language and tone, and
 * a second for the same pair is refused rather than left to a database
 * constraint. No screen can reach it — the control only offers languages that
 * are missing — which is exactly why it is pinned against the mock.
 */
describe('the variant endpoint', () => {
  it('refuses a second wording for the same language and tone', async () => {
    signIn();

    const error = await rejection(
      api.post(`/profile/atoms/${ATOM_ID}/variants`, {
        content: { runs: [{ t: 'A second English wording', m: [] }] },
        language: 'en',
      }),
    );

    expect(error.status).toBe(409);
    expect(error.params?.fields).toEqual(['language']);
  });

  it('refuses content with nothing in it', async () => {
    signIn();

    const error = await rejection(
      api.post(`/profile/atoms/${ATOM_ID}/variants`, {
        content: { runs: [{ t: '   ', m: [] }] },
        language: 'tr',
      }),
    );

    expect(error.status).toBe(400);
    expect(error.params?.fields).toEqual(['content']);
  });
});
