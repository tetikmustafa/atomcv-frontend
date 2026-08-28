import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { SessionNotice } from '@/components/session/SessionNotice';
import type { Session } from '@/lib/api/endpoints/auth';
import { sessionKeys } from '@/lib/api/queryKeys';
import { server } from '@/mocks/node';
import { currentSession, signIn } from '@/mocks/sessionFixture';
import en from '@/messages/en.json';

/** The same body the fixture builds, with the expiry moved. */
function expiringIn(ms: number) {
  const body = currentSession();

  server.use(
    http.get('*/api/v1/auth/session', () =>
      HttpResponse.json<Session>({
        ...body,
        capabilities: {
          ...body.capabilities,
          anonymousExpiresAt: new Date(Date.now() + ms).toISOString(),
        },
      }),
    ),
  );
}

async function renderNotice() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  const utils = render(<SessionNotice />, { wrapper: Wrapper });
  // Every assertion here is about what is drawn *after* the session lands.
  // Without this the absences would all pass for the wrong reason.
  await waitFor(() => expect(client.getQueryData(sessionKeys.current())).toBeDefined());

  return utils;
}

describe('the anonymous session notice', () => {
  it('says nothing while there is still plenty of time', async () => {
    await renderNotice();

    // A banner that stands for two hours is a banner nobody reads, and this
    // one has to be read once.
    expect(screen.queryByTestId('session-notice')).not.toBeInTheDocument();
  });

  it('appears once the window is short enough to matter', async () => {
    expiringIn(5 * 60 * 1000);
    await renderNotice();

    expect(await screen.findByTestId('session-notice')).toBeInTheDocument();
  });

  /**
   * The sliding TTL was chosen so nobody is cut off mid-review, and copy
   * promising a flat two hours would put back the anxiety it removed. The
   * sentence has to name the person's own activity as what moves it.
   */
  it('says the window moves with what the reader does', async () => {
    expiringIn(5 * 60 * 1000);
    await renderNotice();

    expect(await screen.findByTestId('session-notice')).toHaveTextContent(/last activity/i);
    // § 9 and `B-053`: an anonymous profile is one Redis document that nobody
    // gets back. Telling the reader it is saved is the one thing this must
    // never do.
    expect(screen.getByTestId('session-notice')).toHaveTextContent(/nothing is saved/i);
  });

  /** Rule 9: an instant belongs to the reader's clock, not to the wire. */
  it('gives the time in the reader’s own zone, not as an ISO string', async () => {
    const at = new Date(Date.now() + 5 * 60 * 1000);
    expiringIn(5 * 60 * 1000);
    await renderNotice();

    const notice = await screen.findByTestId('session-notice');
    expect(notice).toHaveTextContent(
      new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(at),
    );
    expect(notice).not.toHaveTextContent(/\d{4}-\d{2}-\d{2}T/);
  });

  /**
   * An account has no `anonymousExpiresAt` at all (§ 35.7). The notice must
   * read that absence rather than treat a missing field as "expiring now".
   */
  it('says nothing to an account', async () => {
    signIn();
    await renderNotice();

    expect(screen.queryByTestId('session-notice')).not.toBeInTheDocument();
  });

  it('is announced rather than only drawn', async () => {
    expiringIn(5 * 60 * 1000);
    const { container } = await renderNotice();

    // Rule 6. A border colour says nothing to a screen reader, and this
    // notice appears without the reader having done anything.
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
