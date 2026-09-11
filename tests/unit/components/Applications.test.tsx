import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Applications } from '@/components/applications/Applications';
import { api } from '@/lib/api/client';
import { ApiError, isApiError } from '@/lib/api/errors';
import { applications, forgetGenerationOf } from '@/mocks/applicationHandlers';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';
import type { Application } from '@/lib/api/endpoints/applications';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/applications',
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

async function record(body: Partial<Application> = {}) {
  return api.post<Application>('/applications', {
    company: 'Acme',
    position: 'Backend Engineer',
    ...body,
  });
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const caught: unknown = await promise.catch((error: unknown) => error);
  if (!isApiError(caught)) throw new Error('expected an ApiError');
  return caught;
}

/**
 * Where somebody applied, and what came of it (§ 55, `B-093`).
 */
describe('the application tracker', () => {
  it('asks for nothing without an account, and says why', async () => {
    render(<Applications />, { wrapper: Wrapper });

    expect(await screen.findByText(/needs an account/)).toBeInTheDocument();
    // The request is not made at all: `onUnhandledRequest: 'error'` would not
    // catch a handled 401, so this asserts the absence directly.
    expect(screen.queryByRole('button', { name: en.Applications.add })).not.toBeInTheDocument();
  });

  it('records one with the status and the date the server decides', async () => {
    signIn();
    const user = userEvent.setup();

    render(<Applications />, { wrapper: Wrapper });

    await user.type(await screen.findByLabelText(en.Applications.company), 'Acme');
    await user.type(screen.getByLabelText(en.Applications.position), 'Backend Engineer');
    await user.click(screen.getByRole('button', { name: en.Applications.add }));

    await waitFor(() => expect(applications).toHaveLength(1));

    // Neither was on screen, and neither is this client's to decide: omitted
    // means `applied` and today.
    expect(applications[0]!.status).toBe('applied');
    expect(applications[0]!.appliedAt).toBe(new Date().toISOString().slice(0, 10));
  });

  /**
   * No transition is forbidden — a company that reopens a closed process is
   * not a data error — so every option stays selectable, including going back
   * from `rejected`.
   */
  it('locks no transition, not even out of a closed one', async () => {
    signIn();
    await record({ status: 'rejected' });
    const user = userEvent.setup();

    render(<Applications />, { wrapper: Wrapper });

    const select = await screen.findByLabelText(en.Applications.status);
    expect(within(select).getAllByRole('option')).toHaveLength(5);
    expect(select.querySelectorAll('option:disabled')).toHaveLength(0);

    await user.selectOptions(select, 'interview');

    await waitFor(() => expect(applications[0]!.status).toBe('interview'));
  });

  /**
   * The partiality is the point: moving a row must not carry the notes back,
   * or it overwrites an edit made in another tab.
   */
  it('sends only the status when moving a row', async () => {
    signIn();
    await record({ notes: 'Referred by a friend' });
    const user = userEvent.setup();

    const sent: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PATCH')
        void request
          .clone()
          .text()
          .then((body) => sent.push(body));
    });

    render(<Applications />, { wrapper: Wrapper });

    await user.selectOptions(await screen.findByLabelText(en.Applications.status), 'offer');

    await waitFor(() => expect(applications[0]!.status).toBe('offer'));
    // Off the wire, not off the fixture: a body that carried the notes would
    // still leave them unchanged here and would overwrite another tab's edit
    // in production.
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(JSON.parse(sent[0]!)).toEqual({ status: 'offer' });
    expect(applications[0]!.notes).toBe('Referred by a friend');
  });

  /** `notes: null` means "leave them"; emptying them is its own field. */
  it('empties the notes only when asked to', async () => {
    signIn();
    const created = await record({ notes: 'Referred by a friend' });
    const user = userEvent.setup();

    render(<Applications />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('button', { name: en.Applications.notes }));

    const box = screen.getByLabelText(en.Applications.notesLabel);
    await user.clear(box);
    await user.click(screen.getByRole('button', { name: en.Applications.saveNotes }));

    await waitFor(() => expect(applications[0]!.notes).toBeUndefined());
    expect(applications[0]!.id).toBe(created.id);
  });

  /**
   * A row whose CV was deleted keeps its place and loses its download: the
   * record of applying outlives the document, and a link to a `404` would be
   * worse than the sentence.
   */
  it('offers no resume for a row whose CV has been deleted', async () => {
    signIn();
    const created = await record();
    forgetGenerationOf(created.id!);

    render(<Applications />, { wrapper: Wrapper });

    expect(await screen.findByText(en.Applications.resumeDeleted)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: en.Applications.openResume }),
    ).not.toBeInTheDocument();
  });

  it('forgets one without touching the CV', async () => {
    signIn();
    await record();
    const user = userEvent.setup();

    render(<Applications />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('button', { name: en.Applications.forget }));

    await waitFor(() => expect(applications).toHaveLength(0));
    expect(await screen.findByText(en.Applications.empty)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    signIn();
    await record();

    const { container } = render(<Applications />, { wrapper: Wrapper });

    await screen.findByLabelText(en.Applications.status);
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * The wire behaviours no screen reaches, pinned against the mock because the
 * mock is the contract three environments share.
 */
describe('the application endpoints', () => {
  it('requires If-Match on both writes, and says which refusal it is', async () => {
    signIn();
    const created = await record();

    /*
      Through `fetch` rather than the API client, and that is not laziness:
      the client treats a named `version` of `undefined` as a **wiring bug**
      and throws with its own explanation rather than sending a request with
      no `If-Match`. So the 428 cannot be produced through it, which is the
      point of the rule — and the endpoint still has to answer one.
    */
    const missing = await fetch(`/api/v1/applications/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'offer' }),
    });
    expect(missing.status).toBe(428);

    const stale = await rejection(
      api.patch(`/applications/${created.id}`, { status: 'offer' }, { version: 99 }),
    );
    expect(stale.status).toBe(412);
    expect(stale.code).toBe('VERSION_CONFLICT');

    // Deleting is guarded the same way, and for the same reason: a row
    // removed from a stale screen is one another tab had just changed.
    const deletion = await rejection(api.delete(`/applications/${created.id}`, { version: 99 }));
    expect(deletion.status).toBe(412);
  });

  /** The field is wrong rather than the row missing, so it is a 400. */
  it('refuses somebody else’s generation with a 400 naming the field', async () => {
    signIn();

    const error = await rejection(
      api.post('/applications', {
        company: 'Acme',
        position: 'Backend Engineer',
        generationId: '00000000-0000-4000-8000-000000000000',
      }),
    );

    expect(error.status).toBe(400);
    expect(error.params?.fields).toEqual(['generationId']);
  });

  it('answers with the whole list rather than a page of it', async () => {
    signIn();
    await record({ company: 'One' });
    await record({ company: 'Two' });

    const rows = await api.get<Application[]>('/applications');

    // An array, not an envelope: nothing to page through and no cursor to
    // echo back.
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
  });
});
