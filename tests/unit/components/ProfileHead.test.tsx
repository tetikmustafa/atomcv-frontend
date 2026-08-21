import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { ProfileHead } from '@/components/profile/ProfileHead';
import { useProfile } from '@/hooks/useProfile';
import { getProfile, type Profile } from '@/lib/api/endpoints/profile';
import type { Versioned } from '@/lib/api/client';
import { profileKeys } from '@/lib/api/queryKeys';
import en from '@/messages/en.json';
import { server } from '@/mocks/node';

/**
 * Rendered from a seeded cache, the way the editor does it: the head's version
 * is the `ETag`, and it only reaches the client through the read.
 */
async function renderHead({ observeHead = false }: { observeHead?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const head = await getProfile();
  client.setQueryData(profileKeys.head(), head);

  /** Stands in for `ProfileEditor`, which is what reads the head in the app. */
  function ObserveHead() {
    useProfile();
    return null;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  const user = userEvent.setup();
  const rendered = render(
    <>
      {observeHead && <ObserveHead />}
      <ProfileHead profile={head.data} />
    </>,
    { wrapper: Wrapper },
  );

  return { user, client, ...rendered };
}

/** Every write to the head, so what was actually sent is assertable. */
function recordPuts() {
  const bodies: Record<string, unknown>[] = [];

  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'PUT' && new URL(request.url).pathname.endsWith('/api/v1/profile')) {
      bodies.push((await request.clone().json()) as Record<string, unknown>);
    }
  });

  return bodies;
}

describe('the profile head', () => {
  /**
   * The contact details had nowhere to appear in the editor at all before
   * this — the screen showed a headline and a completeness bar.
   */
  it('shows who you are without being opened', async () => {
    await renderHead();

    expect(screen.getByText(/Elif Yıldırım · elif@example.com/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Headline')).not.toBeInTheDocument();
  });

  /**
   * ⚠️ `PUT` clears what it is not sent — verified against the running server,
   * where a body carrying only `headline` left `contact` as `{}`. So a save
   * must carry the whole head, and a body assembled from the edited field
   * alone would silently erase someone's phone number and their email.
   */
  it('sends the whole head, not just the field that changed', async () => {
    const bodies = recordPuts();
    const { user } = await renderHead();

    await user.click(screen.getByRole('button', { name: 'Edit your details' }));
    await user.clear(screen.getByLabelText('Headline'));
    await user.type(screen.getByLabelText('Headline'), 'Staff Engineer');
    await user.tab();

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      headline: 'Staff Engineer',
      contact: expect.objectContaining({
        name: 'Elif Yıldırım',
        email: 'elif@example.com',
      }),
    });
    // Required by the endpoint, and carried forward rather than invented:
    // an empty array is a 400 naming it.
    expect(bodies[0]).toMatchObject({ enabledLanguages: ['en'] });
  });

  /**
   * ⚠️ The reason there is one autosave for the whole head rather than one per
   * field.
   *
   * Two per-field saves would each build a body from the cache, and the second
   * would be built before the first response landed — putting the old headline
   * back on top of the new one. A single `useAutosave` holds one pending value,
   * so the second edit supersedes the first rather than racing it.
   */
  it('does not undo one field while saving another', async () => {
    const bodies = recordPuts();
    const { user } = await renderHead();

    await user.click(screen.getByRole('button', { name: 'Edit your details' }));

    await user.clear(screen.getByLabelText('Headline'));
    await user.type(screen.getByLabelText('Headline'), 'Staff Engineer');
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '+90 555');
    await user.tab();

    await waitFor(() =>
      expect(bodies.at(-1)).toMatchObject({
        headline: 'Staff Engineer',
        contact: expect.objectContaining({ phone: '+90 555' }),
      }),
    );

    // The precise property, not "every body has both": the debounce may well
    // fire between the two edits, and a body carrying only the headline is
    // correct. What must never happen is the reverse — a request that has the
    // new phone **and** the old headline, which is what a second per-field
    // save built from a not-yet-updated cache would send.
    for (const body of bodies) {
      const contact = body.contact as { phone?: string };
      if (contact?.phone === '+90 555') expect(body.headline).toBe('Staff Engineer');
    }
  });

  /**
   * P8. Closing the panel unmounts nothing here, but a pending edit still has
   * to leave — the same rule as collapsing a section.
   */
  it('flushes a pending edit when the panel is closed', async () => {
    const bodies = recordPuts();
    const { user } = await renderHead();

    await user.click(screen.getByRole('button', { name: 'Edit your details' }));
    await user.type(screen.getByLabelText('Location'), '!');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
  });

  /**
   * Rule 8, and the reason the client does not validate email itself: the
   * server owns that rule and names the field it rejected.
   */
  it('reports the server’s verdict on a bad email rather than its own', async () => {
    const { user } = await renderHead();

    await user.click(screen.getByRole('button', { name: 'Edit your details' }));
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.tab();

    expect(await screen.findByText(/couldn't be accepted: contact\.email/)).toBeInTheDocument();
  });

  /**
   * A stale `ETag` is a conflict, not a retry (Bölüm 37.4). The head's version
   * lives only in the header, so this is the one resource where getting it
   * wrong is invisible until a save fails.
   */
  it('offers a choice rather than a retry when the version has moved', async () => {
    const { user } = await renderHead();

    server.use(
      http.put('*/api/v1/profile', () =>
        HttpResponse.json(
          {
            type: '/errors/version-conflict',
            title: 'VERSION_CONFLICT',
            status: 412,
            code: 'VERSION_CONFLICT',
            instance: '/api/v1/profile',
            resolutions: [{ action: 'retry' }],
          },
          { status: 412 },
        ),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Edit your details' }));
    await user.type(screen.getByLabelText('Headline'), '!');
    await user.tab();

    // "You changed this item in another tab." — a choice, not a retry.
    expect(await screen.findByText(/another tab/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use the other version' })).toBeInTheDocument();
  });

  it('has no accessibility violations once open', async () => {
    const { user, container } = await renderHead();

    await user.click(screen.getByRole('button', { name: 'Edit your details' }));
    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * ⚠️ `F-003`. `PUT /profile` answers with the `completeness` computed
   * **before** the write — measured: adding a `selfDescription` to a profile
   * at 80 answers 80 and reads back 90.
   *
   * `CompletenessBar` renders that number straight from this cache entry, so
   * without the refetch the bar keeps showing the old percentage after every
   * head edit, and nothing else would ever put it right. The two agree
   * whenever the value has not changed, which is what makes it easy to miss.
   */
  it('corrects the completeness the write answered with', async () => {
    // Rendered with a real observer on the head, because the correction is an
    // invalidation and an invalidation needs a `queryFn` to call — a key that
    // was only ever seeded with `setQueryData` has none, and the refetch is
    // silently a no-op. `ProfileEditor` holds exactly this observer open.
    const { user, client } = await renderHead({ observeHead: true });

    expect(client.getQueryData<Versioned<Profile>>(profileKeys.head())?.data.completeness).toBe(80);

    await user.click(screen.getByRole('button', { name: 'Edit your details' }));
    await user.type(screen.getByLabelText('About you'), 'A sentence about me.');
    await user.tab();

    await waitFor(() =>
      expect(client.getQueryData<Versioned<Profile>>(profileKeys.head())?.data.completeness).toBe(
        90,
      ),
    );
  });
});
