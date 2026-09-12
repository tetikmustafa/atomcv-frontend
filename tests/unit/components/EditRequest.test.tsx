import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationResult } from '@/components/generation/GenerationResult';
import { api } from '@/lib/api/client';
import { generationOf } from '@/mocks/generationFixture';
import { signIn } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';
import type { components } from '@/types/api';

type AcceptedJob = components['schemas']['AcceptedJobResponse'];

const push = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => '/generations/gen-1',
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
  push.mockClear();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

const POSTING = [
  'We are seeking a senior backend engineer to join a small platform team.',
  'Responsibilities: designing services, operating them in production, and',
  'mentoring the engineers around you. Requirements: several years of Java,',
  'PostgreSQL, container orchestration and a habit of writing things down.',
  'Preferred qualifications include message queues and infrastructure as code.',
].join(' ');

async function generate() {
  const job = await api.post<AcceptedJob>('/generations', {
    jobDescription: POSTING,
    acknowledgePreflight: false,
  });

  return generationOf(job.jobId);
}

/**
 * Faz G's sentence box (§ 24.2, `B-089`).
 *
 * The behaviour worth pinning is not that a POST goes out. It is that the
 * edit is **not** local state: the answer is a new generation, the old one is
 * retired, and the screen leaves for the new one rather than patching what is
 * on it.
 */
describe('changing a finished resume in words', () => {
  it('says the change costs a generation, because the hand toggle does not', async () => {
    const generationId = await generate();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });

    expect(await screen.findByText(en.Result.editCost)).toBeInTheDocument();
  });

  it('leaves for the generation the edit made, rather than changing this one', async () => {
    const generationId = await generate();
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });

    const box = await screen.findByLabelText(en.Result.editLabel);
    // Names something the profile actually has, which is what the mock's
    // stand-in for the model matches on.
    await user.type(box, 'take out the query monitor bullet');
    await user.click(screen.getByRole('button', { name: en.Result.editSubmit }));

    await waitFor(
      () => {
        expect(push).toHaveBeenCalled();
      },
      { timeout: 5_000 },
    );

    const [destination] = push.mock.calls.at(-1)!;
    expect(destination).toMatch(/^\/generations\//);
    // A **new** generation, not the one that was edited.
    expect(destination).not.toBe(`/generations/${generationId}`);
  }, 15_000);

  /**
   * The common answer, and the one the sentence has to survive: the server
   * would rather do nothing than remove the wrong bullet. A message that only
   * said "we did not understand" would be a dead end, so it names what the
   * box can do.
   */
  it('explains what it can do when the sentence matched nothing', async () => {
    const generationId = await generate();
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });

    const box = await screen.findByLabelText(en.Result.editLabel);
    await user.type(box, 'please make the whole thing sound friendlier');
    await user.click(screen.getByRole('button', { name: en.Result.editSubmit }));

    expect(await screen.findByText(en.errors.EDIT_NOT_UNDERSTOOD)).toBeInTheDocument();
    // The way out the server offered, rendered as a button rather than
    // invented — and the screen did not leave.
    expect(screen.getByRole('button', { name: en.resolutions.retry })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  }, 15_000);

  /**
   * `B-088`'s 409. An already-edited generation is not the one to edit, so
   * the box is replaced by the sentence that says so rather than left to be
   * pressed into an error — and the download stays, because a CV already sent
   * to an employer does not stop existing.
   */
  it('offers no box on a retired generation, and still offers the download', async () => {
    signIn();
    const generationId = await generate();

    // Retired the way the product retires one: by editing it.
    await api.post(`/generations/${generationId}/edits`, {
      instruction: 'take out the query monitor bullet',
    });

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });

    expect(await screen.findByTestId('superseded-note')).toBeInTheDocument();
    expect(screen.queryByLabelText(en.Result.editLabel)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  });

  it('has no accessibility violations', async () => {
    const generationId = await generate();

    const { container } = render(<GenerationResult generationId={generationId} />, {
      wrapper: Wrapper,
    });

    await screen.findByLabelText(en.Result.editLabel);
    expect(await axe(container)).toHaveNoViolations();
  }, 15_000);
});
