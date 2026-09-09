import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionList } from '@/components/profile/SectionList';
import { profileKeys } from '@/lib/api/queryKeys';
import { patchEntry } from '@/lib/api/endpoints/profile';
import { isApiError } from '@/lib/api/errors';
import { fixture } from '@/mocks/profileFixture';
import type { Entry, Section } from '@/lib/api/endpoints/profile';
import { useEditorUiStore } from '@/stores/editorUiStore';
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

  return { user: userEvent.setup(), client, ...render(<SectionList />, { wrapper: Wrapper }) };
}

async function openExperience(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Experience' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
}

/** Every PATCH body, so what actually travelled is assertable. */
function recordPatches() {
  const sent: { path: string; body: Record<string, unknown> }[] = [];

  server.events.on('request:start', async ({ request }) => {
    if (request.method !== 'PATCH') return;
    sent.push({
      path: new URL(request.url).pathname,
      body: (await request.clone().json()) as Record<string, unknown>,
    });
  });

  return sent;
}

beforeEach(() => useEditorUiStore.getState().reset());

describe('editing a section', () => {
  /**
   * ⚠️ The reason this exists. Deleting cascades — a section takes its entries
   * and their bullets with it — so "delete and recreate" is not a way to fix a
   * typo in a title, it is a way to lose everything underneath it.
   */
  it('renames a section without touching what is under it', async () => {
    const sent = recordPatches();
    const { user, client } = renderSections();
    await openExperience(user);

    const before = client.getQueryData<Entry[]>(profileKeys.entries('sec-experience'));
    expect(before).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Edit the section Experience' }));
    await user.clear(await screen.findByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Work history');
    await user.click(screen.getByRole('button', { name: 'Save the section' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Work history' })).toBeInTheDocument(),
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]!.path).toBe('/api/v1/profile/sections/sec-experience');
    expect(client.getQueryData<Entry[]>(profileKeys.entries('sec-experience'))).toHaveLength(2);
  });

  /**
   * `kind` decides what a bullet under the section is called when one is added,
   * so a section created as the wrong kind keeps producing the wrong atoms.
   */
  it('can change what kind the section is', async () => {
    const sent = recordPatches();
    const { user } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Edit the section Experience' }));
    await user.selectOptions(await screen.findByLabelText('What kind'), 'projects');
    await user.click(screen.getByRole('button', { name: 'Save the section' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).toMatchObject({ kind: 'projects', title: 'Experience' });
  });

  /**
   * The version comes from the cached collection, and a reorder moves it. This
   * is the same `If-Match` path `useDeleteSection` uses, so it is worth one
   * assertion that the write is conditional at all.
   */
  it('takes the new version from the response, so a second save works', async () => {
    const { user, client } = renderSections();
    await openExperience(user);

    await user.click(screen.getByRole('button', { name: 'Edit the section Experience' }));
    await user.clear(await screen.findByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'First');
    await user.click(screen.getByRole('button', { name: 'Save the section' }));

    await waitFor(() => {
      const section = client
        .getQueryData<Section[]>(profileKeys.sections())
        ?.find((candidate) => candidate.id === 'sec-experience');
      expect(section?.title).toBe('First');
      expect(section?.version).toBe(1);
    });
  });
});

describe('editing an entry', () => {
  it('opens with the entry’s current values already in the fields', async () => {
    const { user } = renderSections();
    await openExperience(user);

    await user.click(
      screen.getByRole('button', { name: 'Edit the entry Senior Backend Engineer' }),
    );

    expect(await screen.findByLabelText('Title')).toHaveValue('Senior Backend Engineer');
    expect(screen.getByLabelText('Organisation')).toHaveValue('Trendyol');
    expect(screen.getByLabelText('Started')).toHaveValue('2022-04-01');
  });

  /**
   * ⚠️ `PATCH` treats an absent field as "leave it alone", so a cleared box has
   * to travel as `null`. Omitting it would make emptying the organisation
   * silently do nothing — the field would come back on the next render and the
   * user would have no idea why.
   */
  it('sends a cleared field as null rather than leaving it out', async () => {
    const sent = recordPatches();
    const { user } = renderSections();
    await openExperience(user);

    await user.click(
      screen.getByRole('button', { name: 'Edit the entry Senior Backend Engineer' }),
    );
    await user.clear(await screen.findByLabelText('Organisation'));
    await user.click(screen.getByRole('button', { name: 'Save the entry' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).toMatchObject({ organization: null });
    expect('organization' in sent[0]!.body).toBe(true);
  });

  /**
   * ⚠️ The server compares the range against the **result** of the patch, and
   * `params.fields` then names the ends the request sent (`B-036`). Sending
   * both ends every time is what keeps that error pointing at a field the user
   * can actually see.
   */
  it('sends both ends of the range, so a refusal names a visible field', async () => {
    const sent = recordPatches();
    const { user } = renderSections();
    await openExperience(user);

    await user.click(
      screen.getByRole('button', { name: 'Edit the entry Senior Backend Engineer' }),
    );
    await user.clear(await screen.findByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Staff Engineer');
    await user.click(screen.getByRole('button', { name: 'Save the entry' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(Object.keys(sent[0]!.body).sort()).toEqual([
      'endDate',
      'location',
      'organization',
      'startDate',
      'title',
    ]);
  });

  /**
   * The client's own check still answers first — before the round trip and next
   * to the field — even though the server now refuses the same range.
   */
  it('refuses a backwards range without asking the server', async () => {
    const sent = recordPatches();
    const { user } = renderSections();
    await openExperience(user);

    await user.click(
      screen.getByRole('button', { name: 'Edit the entry Senior Backend Engineer' }),
    );
    await user.clear(await screen.findByLabelText('Ended'));
    await user.type(screen.getByLabelText('Ended'), '2019-01-01');
    await user.click(screen.getByRole('button', { name: 'Save the entry' }));

    expect(await screen.findByText('The end cannot come before the start.')).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it('has no accessibility violations with the form open', async () => {
    const { user, container } = renderSections();
    await openExperience(user);

    await user.click(
      screen.getByRole('button', { name: 'Edit the entry Senior Backend Engineer' }),
    );
    await screen.findByLabelText('Title');

    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * The rule the form is shaped around, exercised directly rather than through
 * the UI — the client's own check refuses a backwards range before a request
 * is ever made, so the server's version is otherwise never reached.
 */
describe('the server’s date rule, as the handlers model it', () => {
  const entry = () => fixture.entries.find((candidate) => candidate.id === 'entry-getir')!;

  /**
   * ⚠️ Checked against the **result** of the patch, not the body. Without
   * this, a range could be inverted one field at a time: each request looks
   * fine on its own and the stored pair ends up backwards.
   */
  it('compares a patched end against the other end as stored', async () => {
    const before = entry();
    expect(before.startDate).toBe('2019-08-01');

    const refused = await patchEntry(
      before.id!,
      { endDate: '2018-01-01' },
      before.version as never,
    ).catch((error: unknown) => error);

    expect(isApiError(refused) && refused.code).toBe('VALIDATION_FAILED');
    expect(isApiError(refused) && refused.params).toEqual({ fields: ['endDate'] });
  });

  /** `params.fields` names the ends the request sent, not the pair (`B-036`). */
  it('names both ends when the request carried both', async () => {
    const before = entry();

    const refused = await patchEntry(
      before.id!,
      { startDate: '2022-01-01', endDate: '2019-01-01' },
      before.version as never,
    ).catch((error: unknown) => error);

    expect(isApiError(refused) && refused.params).toEqual({
      fields: ['startDate', 'endDate'],
    });
  });

  /**
   * A patch touching no date is not checked at all — deliberately. A row
   * written backwards before `F-002` closed would otherwise refuse an
   * unrelated title edit, naming a field the form is not even showing.
   */
  it('does not check a patch that touches no date', async () => {
    const before = entry();
    const updated = await patchEntry(
      before.id!,
      { title: 'Renamed without touching the dates' },
      before.version as never,
    );

    expect(updated.title).toBe('Renamed without touching the dates');
  });
});
