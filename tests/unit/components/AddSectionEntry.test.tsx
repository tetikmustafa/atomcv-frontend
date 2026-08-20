import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { AddEntry } from '@/components/profile/AddEntry';
import { AddSection } from '@/components/profile/AddSection';
import { listEntries, listSections, type Section } from '@/lib/api/endpoints/profile';
import { useAnnouncerStore } from '@/stores/announcerStore';
import en from '@/messages/en.json';
import { server } from '@/mocks/node';

const experience: Section = { id: 'sec-experience', kind: 'experience', title: 'Experience' };

function wrap(node: ReactNode) {
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

  return render(node, { wrapper: Wrapper });
}

/** Captures create requests to one path, so "how many" is assertable. */
function record(path: string) {
  const bodies: Record<string, unknown>[] = [];

  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname.endsWith(path)) {
      bodies.push((await request.clone().json()) as Record<string, unknown>);
    }
  });

  return bodies;
}

beforeEach(() => useAnnouncerStore.setState({ announcement: null }));

/**
 * Both forms are loaded on demand — React Hook Form and Zod are 75 KB gzipped
 * and most sessions never open either (rule 4). So opening one is asynchronous
 * and every test has to wait for it, rather than relying on the chunk
 * happening to already be in the module graph.
 */
async function openSectionForm() {
  const user = userEvent.setup();
  const { container } = wrap(<AddSection />);

  await user.click(screen.getByRole('button', { name: 'Add a section' }));
  await screen.findByLabelText('Name');

  return { user, container };
}

describe('adding a section', () => {
  /**
   * Collapsed until asked for: it is the least-used control on the screen and
   * a permanent two-field form under a long profile is noise.
   */
  it('stays out of the way until opened', async () => {
    const user = userEvent.setup();
    wrap(<AddSection />);

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add a section' }));
    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
  });

  it('creates one with the kind that was picked', async () => {
    const { user } = await openSectionForm();

    await user.selectOptions(screen.getByLabelText('What kind'), 'languages');
    await user.type(screen.getByLabelText('Name'), 'Languages I speak');
    await user.click(screen.getByRole('button', { name: 'Add section' }));

    await waitFor(async () => {
      const added = (await listSections()).at(-1);
      expect(added?.title).toBe('Languages I speak');
      expect(added?.kind).toBe('languages');
    });
  });

  /**
   * The select offers every kind the wire declares. A missing one would be a
   * section type the user simply cannot make — invisible, since nothing
   * errors.
   */
  it('offers every kind the API accepts', async () => {
    await openSectionForm();

    const values = screen
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);

    expect(values).toEqual([
      'about',
      'education',
      'experience',
      'projects',
      'skills',
      'soft_skills',
      'languages',
      'custom',
    ]);
  });

  it('refuses an empty name without asking the server', async () => {
    const bodies = record('/profile/sections');
    const { user } = await openSectionForm();

    await user.click(screen.getByRole('button', { name: 'Add section' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This needs a name.');
    expect(bodies).toHaveLength(0);
    // The field says so itself, not only the text below it.
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('announces the section it added', async () => {
    const { user } = await openSectionForm();

    await user.type(screen.getByLabelText('Name'), 'Awards');
    await user.click(screen.getByRole('button', { name: 'Add section' }));

    await waitFor(() =>
      expect(useAnnouncerStore.getState().announcement?.message).toBe('Added the section Awards.'),
    );
  });

  it('has no accessibility violations once open', async () => {
    const { container } = await openSectionForm();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('adding an entry', () => {
  async function openForm() {
    const user = userEvent.setup();
    const { container } = wrap(<AddEntry section={experience} />);

    await user.click(screen.getByRole('button', { name: 'Add a position' }));
    await screen.findByLabelText('Title');

    return { user, container };
  }

  it('creates one, sending only the fields that were filled in', async () => {
    const { user } = await openForm();
    const bodies = record('/profile/entries');

    await user.type(screen.getByLabelText('Title'), 'Staff Engineer');
    await user.type(screen.getByLabelText('Organisation'), 'Acme');
    await user.type(screen.getByLabelText('Started'), '2023-05-01');
    await user.click(screen.getByRole('button', { name: 'Add position' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      sectionId: 'sec-experience',
      title: 'Staff Engineer',
      organization: 'Acme',
      startDate: '2023-05-01',
    });
    // Left blank means "still there" — an empty string would be an end date
    // the heading cannot format.
    expect(bodies[0]).not.toHaveProperty('endDate');
    expect(bodies[0]).not.toHaveProperty('location');
  });

  /**
   * ⚠️ The server accepts this — `201`, verified, raised as `F-002`. The entry
   * heading would then read "May 2023 – May 2020" for good. This check is the
   * only thing between a typo and that.
   */
  it('refuses an end date before the start, and never sends it', async () => {
    const { user } = await openForm();
    const bodies = record('/profile/entries');

    await user.type(screen.getByLabelText('Title'), 'Backwards');
    await user.type(screen.getByLabelText('Started'), '2023-05-01');
    await user.type(screen.getByLabelText('Ended'), '2020-05-01');
    await user.click(screen.getByRole('button', { name: 'Add position' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The end cannot come before the start.',
    );
    expect(bodies).toHaveLength(0);
    // The message is tied to the field it is about, not floating near it.
    expect(screen.getByLabelText('Ended')).toHaveAttribute(
      'aria-describedby',
      'entry-endDate-error',
    );
  });

  /**
   * ⚠️ The double-submit defence. Entry creates carry no `Idempotency-Key` and
   * no `If-Match`, so two requests make two jobs and the server calls both a
   * success.
   */
  it('cannot be submitted twice while the first request is in flight', async () => {
    const { user } = await openForm();
    const bodies = record('/profile/entries');
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.post('*/api/v1/profile/entries', async () => {
        await held;
        return HttpResponse.json({ id: 'entry-new', title: 'Once', version: 0 }, { status: 201 });
      }),
    );

    await user.type(screen.getByLabelText('Title'), 'Once');
    const button = screen.getByRole('button', { name: 'Add position' });
    await user.click(button);
    await waitFor(() => expect(bodies).toHaveLength(1));

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    // Cancel is disabled too: closing the form mid-flight would leave the
    // request to land with nothing on screen accounting for it.
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Adding…' }));
    expect(bodies).toHaveLength(1);

    release();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add a position' })).toBeInTheDocument(),
    );
    expect(bodies).toHaveLength(1);
  });

  it('closes and announces once the entry exists', async () => {
    const { user } = await openForm();

    await user.type(screen.getByLabelText('Title'), 'Principal Engineer');
    await user.click(screen.getByRole('button', { name: 'Add position' }));

    await waitFor(() =>
      expect(useAnnouncerStore.getState().announcement?.message).toBe('Added Principal Engineer.'),
    );
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect((await listEntries('sec-experience')).at(-1)?.title).toBe('Principal Engineer');
  });

  it('has no accessibility violations once open', async () => {
    // Scoped to the render container, not `document.body`. Axe's `region`
    // rule wants every node inside a landmark, and this form lives inside
    // `<main>` in the app — asserting on the bare body would only be flagging
    // the fixture for not being a page.
    const { container } = await openForm();
    expect(await axe(container)).toHaveNoViolations();
  });
});
