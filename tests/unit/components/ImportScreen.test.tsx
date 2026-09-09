import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportScreen } from '@/components/onboarding/ImportScreen';
import { getSession } from '@/lib/api/endpoints/auth';
import { importCv } from '@/lib/api/endpoints/profile';
import { profileKeys, sessionKeys } from '@/lib/api/queryKeys';
import { failNextJob } from '@/mocks/generationFixture';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import en from '@/messages/en.json';

const push = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/onboarding',
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

/**
 * The session is prefetched rather than seeded by hand: one of the messages
 * below branches on who is asking (`B-053`), and it has to branch on the same
 * answer the product would get.
 */
async function renderImport() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await client.prefetchQuery({ queryKey: sessionKeys.current(), queryFn: getSession });
  // Something for the import to invalidate, so the test below can see whether
  // it did.
  client.setQueryData(profileKeys.head(), { data: { headline: 'the old profile' } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return { client, ...render(<ImportScreen />, { wrapper: Wrapper }) };
}

function cv(name = 'cv.pdf', bytes = 'a real CV would go here') {
  return new File([bytes], name, { type: 'application/pdf' });
}

async function upload(file = cv()) {
  await userEvent.upload(screen.getByLabelText(en.Onboarding.fileLabel), file);
  await userEvent.click(screen.getByRole('button', { name: en.Onboarding.upload }));
}

/** Every request the screen made, in order, with the header that matters. */
let calls: { url: string; key: string | null }[] = [];

function record({ request }: { request: Request }) {
  if (request.url.includes('/profile/import')) {
    calls.push({ url: request.url, key: request.headers.get('Idempotency-Key') });
  }
}

beforeEach(() => {
  calls = [];
  push.mockClear();
  server.events.on('request:start', record);
});

afterEach(() => server.events.removeListener('request:start', record));

describe('uploading a CV', () => {
  /**
   * `accept` is tempting and wrong. The accepted list has one owner, and the
   * server publishes it in the `415` (`B-051`) — a picker that filtered on a
   * copy would go on hiding a format the day the server started reading it.
   */
  it('filters on nothing, because the list is not ours', async () => {
    await renderImport();

    expect(screen.getByLabelText(en.Onboarding.fileLabel)).not.toHaveAttribute('accept');
  });

  it('waits for a file before it will send anything', async () => {
    await renderImport();

    expect(screen.getByRole('button', { name: en.Onboarding.upload })).toBeDisabled();
  });

  it('follows the job and hands over to the review', async () => {
    await renderImport();
    await upload();

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    await waitFor(
      () => expect(push).toHaveBeenCalledWith(expect.stringContaining('/onboarding/review?job=')),
      { timeout: 4000 },
    );
  });

  /**
   * Everything cached describes the profile that was there before this ran.
   * Dropped when the job **finishes** rather than when it is accepted: the
   * rows are written by the worker, so a cache emptied at the 202 would refill
   * from the old profile seconds before the new one existed.
   */
  it('throws away what was cached about the profile it replaced', async () => {
    const { client } = await renderImport();
    await upload();

    expect(client.getQueryState(profileKeys.head())?.isInvalidated).toBe(false);
    await waitFor(
      () => expect(client.getQueryState(profileKeys.head())?.isInvalidated).toBe(true),
      { timeout: 4000 },
    );
  });

  it('says what it would have accepted, in the server’s words', async () => {
    await renderImport();
    await upload(new File(['x'], 'photo.png'));

    expect(await screen.findByRole('alert')).toHaveTextContent('pdf, docx, tex, txt, and md');
  });

  it('tells a scan apart from an empty file', async () => {
    await renderImport();
    await upload(cv('scanned-cv.pdf'));

    expect(await screen.findByRole('alert')).toHaveTextContent('a scan rather than text');
  });
});

describe('when the account already has a profile', () => {
  /**
   * `B-060`: two ways out and no third. Merging means atom-level
   * deduplication — Stage 4 work — so a third button would name an action
   * nothing can perform.
   */
  it('offers exactly the two the server sent', async () => {
    signIn();
    await renderImport();
    await upload();

    const panel = await screen.findByRole('alert');
    expect(panel).toHaveTextContent('already has a profile');
    expect(
      within(panel)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Replace my profile with this CV', 'Keep the profile I have']);
  });

  it('resends the same file with the mode that means consent', async () => {
    signIn();
    await renderImport();
    await upload();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Replace my profile with this CV' }),
    );

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(new URL(calls[0]!.url).search).toBe('');
    expect(new URL(calls[1]!.url).searchParams.get('mode')).toBe('replace');

    // Same key: answering a refusal is the same attempt at the same file, one
    // question later, and the refusal made no job for it to collide with.
    expect(calls[1]!.key).toBe(calls[0]!.key);
  });

  /**
   * The other answer sends nothing at all. Leaving the reader on the upload
   * form they have just decided against is the wrong place to leave them.
   */
  it('sends nothing when the reader keeps what they have', async () => {
    signIn();
    await renderImport();
    await upload();

    await userEvent.click(await screen.findByRole('button', { name: 'Keep the profile I have' }));

    expect(calls).toHaveLength(1);
    expect(push).toHaveBeenCalledWith('/profile');
  });
});

describe('when the allowance is gone', () => {
  /**
   * Spent through the endpoint rather than through the screen, because the
   * screen does not come back: a successful upload hands over to the review,
   * and the router that would take it there is a spy here. Three imports is
   * the anonymous allowance (§ 44.1).
   */
  async function exhaust() {
    for (const key of ['key-1', 'key-2', 'key-3']) {
      await importCv(cv(`${key}.pdf`), { idempotencyKey: key });
    }

    await renderImport();
    await upload(cv('one-too-many.pdf'));
  }

  /**
   * `B-053`, and it is the one place the anonymous path is allowed to read
   * differently. The allowance is counted per **address** (§ 44.1), so
   * somebody in the same office can have spent it — and "you have used yours
   * up" would then be the product blaming the reader for a stranger.
   */
  it('does not tell an anonymous reader it was their allowance', async () => {
    await exhaust();

    const panel = await screen.findByRole('alert');
    expect(panel).toHaveTextContent('from this network');
    expect(panel).not.toHaveTextContent("You've reached today's limit");
  });
});

describe('when the job fails', () => {
  it('shows what came back and offers another file', async () => {
    failNextJob({ code: 'ALL_PROVIDERS_UNAVAILABLE', resolutions: [{ action: 'retry' }] });
    await renderImport();
    await upload();

    const panel = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(panel).toHaveTextContent('None of the AI providers answered');
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
  });
});

/**
 * § 35.7.4 (`B-083`): an upload from a caller with no account has to carry a
 * Turnstile token, as a **form field** beside the file. The unit suite runs
 * with Cloudflare's always-passing test key configured — see
 * `vitest.config.mts` — so the widget here is a real one.
 */
describe('the challenge on an anonymous upload', () => {
  it('is drawn for a caller without an account', async () => {
    await renderImport();

    expect(await screen.findByTestId('turnstile')).toBeInTheDocument();
  });

  it('is not drawn for an account, which answered one to sign in', async () => {
    signIn();
    await renderImport();

    // Awaited on something that does appear, so this is not asserting on a
    // render that has not happened yet.
    await screen.findByLabelText(en.Onboarding.fileLabel);
    expect(screen.queryByTestId('turnstile')).not.toBeInTheDocument();
  });

  it('sends no field at all when the widget produced no token', async () => {
    await renderImport();

    const bodies: Promise<FormData>[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/profile/import')) bodies.push(request.clone().formData());
    });

    await upload();
    await waitFor(() => expect(bodies).toHaveLength(1));

    /*
      Nothing loads Cloudflare's script in jsdom, so no callback fires. Absent
      rather than empty is the assertion that matters: the server counts an
      empty value as a **failed** challenge (`B-083`), so a client that always
      sent the field would turn a deployment with no Turnstile secret — the
      local one — into a wall.
    */
    expect((await bodies[0]!).get('challengeToken')).toBeNull();
  });
});
