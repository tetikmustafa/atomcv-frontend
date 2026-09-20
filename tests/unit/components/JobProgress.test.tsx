import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobProgress } from '@/components/generation/JobProgress';
import { jobKeys } from '@/lib/api/queryKeys';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/generate',
}));

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

/**
 * Seeded rather than streamed.
 *
 * `SCORING` lasts two hundred milliseconds in the fixture's schedule, and the
 * notes are explicit that a test which waits for an instant in a stream is
 * racing it. What this file is about is a condition on one field, so the
 * field is set and the stream left alone — `useJobStream` reads the cache
 * either way, and the fallback and the stream write to the same key.
 */
function renderAt(phaseKey: string | null, pct = 50) {
  client.setQueryData(jobKeys.status('job-1'), {
    jobId: 'job-1',
    status: 'running',
    pct,
    ...(phaseKey ? { label: phaseKey } : {}),
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(
    <JobProgress
      jobId="job-1"
      onResolve={vi.fn()}
      canResolve={() => false}
      onStartOver={vi.fn()}
    />,
    { wrapper: Wrapper },
  );
}

/**
 * Why the bar can sit still (`B-107`).
 *
 * § 21.8's second step landed: a profile with no wording in the posting's
 * language has the missing ones translated **between Faz B and Faz C**, up to
 * sixty calls, all inside `SCORING`. So the bar waits here for a reason that
 * has nothing to do with scoring, and a reader watching it stop cannot tell a
 * slow step from a stuck one.
 */
describe('the wait inside scoring', () => {
  it('explains it, and says the second time is free', async () => {
    renderAt('generation.phase.SCORING');

    const note = await screen.findByTestId('translation-note');

    expect(note).toHaveTextContent(en.Generation.translationNote);
    // The fact that makes the wait worth sitting through: the translations
    // are written back to the profile rather than thrown away.
    expect(note).toHaveTextContent(/next one is quick/);
  });

  /**
   * Only this phase. Any of them can be slow; a caption that explained every
   * wait would be explaining nothing, and this is the one whose cause is
   * invisible from the label above it.
   */
  it.each([
    ['generation.phase.ANALYSING'],
    ['generation.phase.MEASURING'],
    ['generation.phase.REWRITING'],
    ['generation.phase.RENDERING'],
  ])('says nothing during %s', async (phaseKey) => {
    renderAt(phaseKey);

    await screen.findByTestId('phase-caption');
    expect(screen.queryByTestId('translation-note')).toBeNull();
  });

  /**
   * The comparison is against the **whole key**, because that is what the
   * server sends. Testing `'SCORING'` would be false on every frame and
   * silently so — a note that never appears is indistinguishable from a
   * generation with nothing to translate.
   */
  it('matches the key the server sends rather than the phase name', async () => {
    renderAt('SCORING');

    await screen.findByTestId('phase-caption');
    expect(screen.queryByTestId('translation-note')).toBeNull();
  });
});
