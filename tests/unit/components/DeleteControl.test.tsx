import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionList } from '@/components/profile/SectionList';
import { useEditorUiStore } from '@/stores/editorUiStore';
import { fixture } from '@/mocks/profileFixture';
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

  return { user: userEvent.setup(), ...render(<SectionList />, { wrapper: Wrapper }) };
}

/** Opens Experience — two entries, three atoms — and waits for it. */
async function openExperience(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Experience' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
}

/** Every delete request that actually left, so "nothing happened" is assertable. */
function recordDeletes() {
  const sent: string[] = [];

  server.events.on('request:start', ({ request }) => {
    if (request.method === 'DELETE') sent.push(new URL(request.url).pathname);
  });

  return sent;
}

beforeEach(() => useEditorUiStore.getState().reset());

describe('deleting', () => {
  /**
   * ⚠️ The reason the dialog exists at all.
   *
   * The cascade is the server's and it is total — measured: deleting a section
   * takes its entries, their atoms, and the atoms hanging straight off it.
   * A control that said only "delete this section" would be describing a much
   * smaller act than the one it performs, so the counts are the message.
   */
  it('says how much a section takes with it', async () => {
    const { user } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Delete the section Experience' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/It holds 2 entries and 3 bullets/)).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
  });

  /**
   * A section with atoms but no entries is the other shape a section comes in
   * — Skills — and the sentence has to be whole for it too. The verb agrees
   * with the count, which is why the plural wraps the clause and not the
   * number.
   */
  it('counts a section that has bullets but no entries', async () => {
    const { user } = renderSections();
    await user.click(await screen.findByRole('button', { name: 'Skills' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'Delete the section Skills' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/It holds 1 bullet, and it goes with it/)).toBeInTheDocument();
  });

  it('counts what an entry takes with it', async () => {
    const { user } = renderSections();
    await openExperience(user);

    await user.click(
      screen.getByRole('button', { name: 'Delete the entry Senior Backend Engineer' }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Its 2 bullets go with it/)).toBeInTheDocument();
  });

  /**
   * Opening the dialog must not be the deletion. The trigger and the
   * confirmation being two separate acts is the entire protection here —
   * there is no undo, because no endpoint recreates a cascaded tree.
   */
  it('sends nothing until the confirmation is answered', async () => {
    const sent = recordDeletes();
    const { user } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Delete the section Experience' }));
    await screen.findByRole('alertdialog');

    expect(sent).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    expect(sent).toHaveLength(0);
  });

  it('deletes the section once confirmed, and the row goes', async () => {
    const experienceId = fixture.sections.find((section) => section.title === 'Experience')!.id;
    const sent = recordDeletes();
    const { user } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Delete the section Experience' }));
    await user.click(await screen.findByRole('button', { name: 'Delete the section' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Experience' })).not.toBeInTheDocument(),
    );
    // Captured before the click: the handler removes it from the fixture, so
    // reading the id afterwards reads whichever section moved into its place.
    expect(sent).toEqual([`/api/v1/profile/sections/${experienceId}`]);
  });

  /**
   * ⚠️ A failure has to be readable, and the only place it can be read is
   * inside the dialog.
   *
   * Letting the action close the dialog and firing the mutation behind it puts
   * the explanation nowhere: the panel that would name the conflict is inside
   * a dialog that has already gone, and the row the user was looking at is
   * unchanged with no reason given. So the close waits for the server.
   */
  it('keeps the dialog open and explains when the server refuses', async () => {
    server.use(
      http.delete('*/api/v1/profile/sections/:id', () =>
        HttpResponse.json(
          {
            type: '/errors/version-conflict',
            title: 'VERSION_CONFLICT',
            status: 412,
            code: 'VERSION_CONFLICT',
            instance: '/api/v1/profile/sections/sec-experience',
            resolutions: [{ action: 'retry' }],
          },
          { status: 412 },
        ),
      ),
    );

    const { user } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Delete the section Experience' }));
    await user.click(await screen.findByRole('button', { name: 'Delete the section' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(await within(dialog).findByText(/changed somewhere else/)).toBeInTheDocument();

    // Still there, and so is the section. `hidden: true` because the dialog
    // is modal and Radix takes the rest of the page out of the accessibility
    // tree while it is open — which is the behaviour we want, so the test asks
    // the way the DOM is rather than asking for it to be otherwise.
    expect(screen.getByRole('button', { name: 'Experience', hidden: true })).toBeInTheDocument();
  });

  /**
   * A failure from the last attempt must not greet the next opening — it
   * describes a request that is no longer the one being made.
   */
  it('clears a previous failure when the dialog is reopened', async () => {
    server.use(
      http.delete(
        '*/api/v1/profile/sections/:id',
        () =>
          HttpResponse.json(
            {
              type: '/errors/version-conflict',
              title: 'VERSION_CONFLICT',
              status: 412,
              code: 'VERSION_CONFLICT',
              instance: '/api/v1/profile/sections/sec-experience',
            },
            { status: 412 },
          ),
        { once: true },
      ),
    );

    const { user } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Delete the section Experience' }));
    await user.click(await screen.findByRole('button', { name: 'Delete the section' }));
    await screen.findByText(/changed somewhere else/);

    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete the section Experience' }));
    await screen.findByRole('alertdialog');

    expect(screen.queryByText(/changed somewhere else/)).not.toBeInTheDocument();
  });

  /**
   * Rule 5. The dialog is reachable and answerable without a pointer, and
   * `AlertDialog` puts focus on the way out rather than on the destructive
   * action — which is the reason it is that component and not `Dialog`.
   */
  it('can be cancelled from the keyboard, and does not open focused on delete', async () => {
    const sent = recordDeletes();
    const { user } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Delete the section Experience' }));
    const dialog = await screen.findByRole('alertdialog');

    expect(within(dialog).getByRole('button', { name: 'Keep it' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(sent).toHaveLength(0);
  });

  it('names each bullet’s own delete control by its words', async () => {
    const { user } = renderSections();
    await openExperience(user);

    expect(
      screen.getByRole('button', { name: /Delete the bullet Engineered ETL pipelines/ }),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations with the dialog open', async () => {
    const { user, container } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Delete the section Experience' }));
    await screen.findByRole('alertdialog');

    // The dialog is portalled out of `container`, so both are checked.
    expect(await axe(container)).toHaveNoViolations();
    expect(await axe(screen.getByRole('alertdialog'))).toHaveNoViolations();
  });
});
