import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddSection } from '@/components/profile/AddSection';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { ProfileHead } from '@/components/profile/ProfileHead';
import { getSession } from '@/lib/api/endpoints/auth';
import { getProfile, listAtoms, listSections, type Atom } from '@/lib/api/endpoints/profile';
import { profileKeys, sessionKeys } from '@/lib/api/queryKeys';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

let client: QueryClient;

/** Every write, so "sent what was chosen" is assertable. */
let bodies: { url: string; body: Promise<string> }[] = [];

function record({ request }: { request: Request }) {
  if (request.method !== 'GET') bodies.push({ url: request.url, body: request.clone().text() });
}

beforeEach(() => {
  bodies = [];
  server.events.on('request:start', record);
  return () => server.events.removeListener('request:start', record);
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

async function prepare({ account = true } = {}) {
  if (account) signIn();

  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await client.prefetchQuery({ queryKey: sessionKeys.current(), queryFn: getSession });
}

/**
 * D13 closed five deliberate gaps, and each was closed because **its reason
 * had gone stale** rather than because it had become possible. These are the
 * three whose reason was a sentence in `notes/current.md` that was no longer
 * true.
 */
describe('the section layout picker', () => {
  /**
   * The gap named its own condition: drawing this needs an ICU name for every
   * value *and* a sensible default for About, because half of it hands
   * somebody a choice whose meaning they cannot read.
   */
  it('offers the four layouts the wire still has, and not the fifth', async () => {
    await prepare();
    const user = userEvent.setup();
    render(<AddSection />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: en.Editor.addSection.open }));
    const chooser = await screen.findByLabelText(en.Editor.addSection.layout);

    const values = within(chooser)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);

    expect(values).toEqual(['bullet_list', 'entry_list', 'inline_list', 'paragraph']);
    // `two_column` left with V17 (`B-116`), and it is the one worth naming:
    // the endpoint accepted it and the renderer printed something else.
    expect(values).not.toContain('two_column');
  });

  /**
   * § 33.4.1: a summary is one flowing paragraph, and printed as a list it
   * reads as the first item of a list that never comes. The server already
   * writes the right layout per kind, so a form that always suggested bullets
   * would be arguing with it.
   */
  it('follows the kind with a suggestion, until the reader makes one', async () => {
    await prepare();
    const user = userEvent.setup();
    render(<AddSection />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: en.Editor.addSection.open }));
    const kind = await screen.findByLabelText(en.Editor.addSection.kind);
    const layout = screen.getByLabelText(en.Editor.addSection.layout);

    await user.selectOptions(kind, 'about');
    expect(layout).toHaveValue('paragraph');

    await user.selectOptions(kind, 'skills');
    expect(layout).toHaveValue('inline_list');

    // Once chosen, it is a decision. Correcting the kind afterwards must not
    // overwrite it — that would be the form deciding it knew better.
    await user.selectOptions(layout, 'bullet_list');
    await user.selectOptions(kind, 'about');
    expect(layout).toHaveValue('bullet_list');
  });

  it('sends the layout it was showing', async () => {
    await prepare();
    const user = userEvent.setup();
    render(<AddSection />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: en.Editor.addSection.open }));
    await screen.findByLabelText(en.Editor.addSection.layout);

    await user.selectOptions(screen.getByLabelText(en.Editor.addSection.kind), 'about');
    await user.type(screen.getByLabelText(en.Editor.addSection.title), 'Summary');
    await user.click(screen.getByRole('button', { name: en.Editor.addSection.submit }));

    await waitFor(async () => expect((await listSections()).at(-1)?.layout).toBe('paragraph'));
  });
});

describe('the content-language axis', () => {
  async function openHead() {
    const profile = await getProfile();
    const user = userEvent.setup();

    render(<ProfileHead profile={profile.data} />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: en.Editor.head.edit }));

    return user;
  }

  /**
   * The gap's stated reason was that `capabilities.allowedLanguages` was not
   * published. It has been since `B-081` — so what was left was an unbuilt
   * control rather than a missing answer, which is how a deliberate gap turns
   * into an unnoticed one.
   */
  it('offers the languages the server allows, not the interface locales', async () => {
    await prepare();
    await openHead();

    const chooser = await screen.findByLabelText(en.Editor.languages.sourceLabel);
    const values = within(chooser)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);

    expect(values).toEqual(['en', 'tr']);
  });

  /**
   * `enabledLanguages` must contain the source: a profile written in Turkish
   * that may not be rendered in Turkish has nothing to render, and the server
   * refuses the body rather than working out what was meant. The checkbox is
   * disabled **and says why** rather than being absent — a control that
   * disappears when it becomes load-bearing teaches nothing.
   */
  it('will not let the source language be switched off', async () => {
    await prepare();
    await openHead();

    const source = await screen.findByLabelText(/English/);

    expect(source).toBeChecked();
    expect(source).toBeDisabled();
    expect(source).toHaveAccessibleDescription(en.Editor.languages.sourceAlwaysOn);
  });

  /** Nothing to choose between is not a choice: anonymous is English-only. */
  it('draws nothing when the server allows one language', async () => {
    await prepare({ account: false });
    await openHead();

    await screen.findByLabelText(en.Editor.head.headline);
    expect(screen.queryByLabelText(en.Editor.languages.sourceLabel)).toBeNull();
  });
});

describe('deleting one wording', () => {
  async function openEditor(atomId: string) {
    await prepare();

    const atoms = await listAtoms();
    for (const atom of atoms) client.setQueryData(profileKeys.atom(atom.id!), atom);
    client.setQueryData(profileKeys.atoms(), atoms);

    render(<AtomEditor atomId={atomId} />, { wrapper: Wrapper });
    return userEvent.setup();
  }

  const cached = (id: string) => client.getQueryData<Atom>(profileKeys.atom(id));

  /**
   * The gap's reason was "the thing being deleted is the item". True of the
   * usual case, and never true of an atom with two wordings — the endpoint
   * and both its refusals were already written, and only the button was
   * missing.
   */
  it('removes the wording that is open, leaving the item and the other one', async () => {
    const user = await openEditor('atom-2');

    await user.click(await screen.findByRole('tab', { name: /Turkish/ }));
    await user.click(
      screen.getByRole('button', {
        name: en.Editor.variants.deleteTrigger.replace('{language}', 'Turkish'),
      }),
    );

    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: en.Editor.variants.deleteConfirm }),
    );

    await waitFor(() => expect(cached('atom-2')?.variants).toHaveLength(1));
    // The item is still here, and so is the wording a CV is built from.
    expect(cached('atom-2')?.variants?.[0]?.primary).toBe(true);
  });

  /**
   * Both refusals the server makes come from one condition on screen: the
   * primary cannot go, and `primary: false` implies there is another, so an
   * atom with a single wording never offers the control either.
   */
  it('offers nothing on a primary wording, or on an only one', async () => {
    await openEditor('atom-2');
    await screen.findByRole('tablist');

    // Opens on the primary.
    expect(screen.queryByRole('button', { name: /Delete the .* wording/ })).toBeNull();
  });

  it('offers nothing at all on an atom with one wording', async () => {
    await openEditor('atom-1');
    await screen.findByLabelText(en.Editor.atom.text);

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete the .* wording/ })).toBeNull();
  });
});
