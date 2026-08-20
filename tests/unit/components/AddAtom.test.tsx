import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { AddAtom } from '@/components/profile/AddAtom';
import { listAtoms, type Entry, type Section } from '@/lib/api/endpoints/profile';
import { useAnnouncerStore } from '@/stores/announcerStore';
import en from '@/messages/en.json';
import { server } from '@/mocks/node';

const experience: Section = { id: 'sec-experience', kind: 'experience', title: 'Experience' };
const skills: Section = { id: 'sec-skills', kind: 'skills', title: 'Skills' };
const job: Entry = { id: 'entry-trendyol', sectionId: 'sec-experience', title: 'Senior' };

function renderAdd(section: Section, entry?: Entry) {
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

  return render(<AddAtom section={section} {...(entry ? { entry } : {})} />, { wrapper: Wrapper });
}

/** Captures every create request, so "how many" is assertable. */
function recordCreates() {
  const bodies: Record<string, unknown>[] = [];

  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/profile/atoms')) {
      bodies.push((await request.clone().json()) as Record<string, unknown>);
    }
  });

  return bodies;
}

beforeEach(() => useAnnouncerStore.setState({ announcement: null }));

describe('adding a bullet', () => {
  it('creates it under the entry it was typed into', async () => {
    const user = userEvent.setup();
    renderAdd(experience, job);

    await user.type(screen.getByLabelText('Add a bullet'), 'Shipped the thing');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(async () => {
      const added = (await listAtoms({ entryId: 'entry-trendyol' })).at(-1);
      expect(added?.variants?.[0]?.plainText).toBe('Shipped the thing');
      expect(added?.kind).toBe('bullet');
    });
  });

  /**
   * The other shape. A skills section has no entries, so its atoms carry no
   * `entryId` at all — sending one that happens to be in scope would file the
   * new atom under a job it has nothing to do with.
   */
  it('creates a section’s own atom with no entry, and the section’s kind', async () => {
    const user = userEvent.setup();
    const bodies = recordCreates();
    renderAdd(skills);

    await user.type(screen.getByLabelText('Add a bullet'), 'Go');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('entryId');
    // Mapped from the section: eight section kinds, five atom kinds, and
    // `AtomCreate.kind` is required, so something has to choose.
    expect(bodies[0]).toMatchObject({ sectionId: 'sec-skills', kind: 'skill' });
  });

  /**
   * ⚠️ The double-submit defence, and there is nothing behind it.
   *
   * A profile create carries no `If-Match` — there is no version to quote for
   * a thing that does not exist — and no `Idempotency-Key`, which covers the
   * Stage 2 endpoints that start work rather than these
   * (`spec/08b-api-contract.md` § D.6.5). So the server answers two requests with two
   * bullets and calls both a success. The user finds the duplicate later with
   * nothing to say where it came from.
   *
   * The handler is held open to make the window an ordering rather than a
   * race: once the first request has started, the control is in whatever state
   * it is going to be in.
   *
   * The `disabled` attribute is what this actually pins — removing it fails
   * this test, while removing the guard inside `submit` does not, because no
   * path reaches it today.
   */
  it('cannot be submitted twice while the first request is in flight', async () => {
    const user = userEvent.setup();
    const bodies = recordCreates();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.post('*/api/v1/profile/atoms', async () => {
        await held;
        return HttpResponse.json({ id: 'atom-new', version: 0 }, { status: 201 });
      }),
    );

    renderAdd(experience, job);
    const field = screen.getByLabelText('Add a bullet');
    await user.type(field, 'Only once');

    const button = screen.getByRole('button', { name: 'Add' });
    await user.click(button);
    await waitFor(() => expect(bodies).toHaveLength(1));

    // Disabled, and saying so rather than looking idle.
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeInTheDocument();
    expect(field).toBeDisabled();

    // A second click gets nowhere. Enter gets nowhere either, but for a
    // different reason worth pinning: inside a `<textarea>` it inserts a
    // newline rather than submitting. If the field ever becomes a single-line
    // input, that stops being true and this catches it.
    await user.click(button);
    field.focus();
    await user.keyboard('{Enter}');

    expect(bodies).toHaveLength(1);

    release();

    // Back to rest: the field is usable again and the button has stopped
    // saying "Adding…". It stays disabled, correctly — the field was cleared
    // on success, so there is nothing to add.
    await waitFor(() => expect(field).not.toBeDisabled());
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(field).toHaveValue('');
    expect(bodies).toHaveLength(1);
  });

  it('refuses to send an empty bullet, or one that is only spaces', async () => {
    const user = userEvent.setup();
    const bodies = recordCreates();
    renderAdd(experience, job);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await user.type(screen.getByLabelText('Add a bullet'), '   ');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await user.keyboard('{Enter}');
    expect(bodies).toHaveLength(0);
  });

  it('trims what it sends, and clears the field afterwards', async () => {
    const user = userEvent.setup();
    const bodies = recordCreates();
    renderAdd(experience, job);

    const field = screen.getByLabelText('Add a bullet');
    await user.type(field, '  Padded  ');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(field).toHaveValue(''));
    expect(bodies[0]).toMatchObject({ content: { runs: [{ t: 'Padded', m: [] }] } });
  });

  /**
   * Rule 6. The new bullet appears somewhere below the form, which is nothing
   * at all to a screen reader — the only thing that says the click worked.
   */
  it('announces that it landed', async () => {
    const user = userEvent.setup();
    renderAdd(experience, job);

    await user.type(screen.getByLabelText('Add a bullet'), 'Announce me');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(useAnnouncerStore.getState().announcement).toMatchObject({
        message: 'Added.',
        urgency: 'polite',
      }),
    );
  });

  /**
   * Rule 7: the way out is the server's to name. The text stays in the field
   * so that retrying is re-submitting rather than retyping.
   */
  it('keeps the text when the server refuses it', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/profile/atoms', () =>
        HttpResponse.json(
          {
            type: '/errors/validation-failed',
            title: 'VALIDATION_FAILED',
            status: 400,
            code: 'VALIDATION_FAILED',
            instance: '/api/v1/profile/atoms',
          },
          { status: 400 },
        ),
      ),
    );

    renderAdd(experience, job);
    const field = screen.getByLabelText('Add a bullet');
    await user.type(field, 'Refused');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(field).toHaveValue('Refused');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderAdd(experience, job);
    expect(await axe(container)).toHaveNoViolations();
  });
});
