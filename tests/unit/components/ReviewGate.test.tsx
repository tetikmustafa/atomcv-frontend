import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewGate } from '@/components/onboarding/ReviewGate';
import { jobKeys } from '@/lib/api/queryKeys';
import en from '@/messages/en.json';

const push = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/onboarding/review',
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const JOB = 'job-1';

function renderGate({ jobId, warnings }: { jobId?: string; warnings?: number } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  if (warnings !== undefined) {
    // Written the way the stream writes it: the terminal payload, kept whole,
    // under the job's own key.
    client.setQueryData(jobKeys.status(JOB), {
      jobId: JOB,
      status: 'completed',
      pct: 100,
      result: { warningCount: warnings },
    });
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<ReviewGate {...(jobId ? { jobId } : {})} />, { wrapper: Wrapper });
}

beforeEach(() => push.mockClear());

describe('the review after an import', () => {
  /**
   * The rule this screen exists for: extraction is never perfectly accurate,
   * and a mistake nobody looked at propagates into every CV made from the
   * profile afterwards. So there is no way past it that is not the button.
   */
  it('offers no way to skip it', () => {
    renderGate({ jobId: JOB, warnings: 0 });

    const labels = screen.getAllByRole('button').map((button) => button.textContent ?? '');

    expect(labels.some((label) => /skip|later|not now/i.test(label))).toBe(false);
    expect(screen.getByRole('button', { name: en.Onboarding.confirm })).toBeInTheDocument();
  });

  it('leads on once the reader says it looks right', async () => {
    renderGate({ jobId: JOB, warnings: 0 });

    await userEvent.click(screen.getByRole('button', { name: en.Onboarding.confirm }));

    expect(push).toHaveBeenCalledWith('/generate');
  });

  it('says how many things extraction was unsure about', () => {
    renderGate({ jobId: JOB, warnings: 2 });

    expect(screen.getByTestId('review-warnings')).toHaveTextContent('unsure about 2 things');
  });

  /**
   * A note, not a warning: nothing is broken and there is nothing to retry.
   * The same distinction the thin-profile note is drawn on.
   */
  it('says nothing when there was nothing to be unsure about', () => {
    renderGate({ jobId: JOB, warnings: 0 });

    // By test id, not by role: the editor underneath has live regions of its
    // own — the save indicator is a `status` too — and an unscoped absence
    // check would pass or fail on which of them had rendered yet.
    expect(screen.queryByTestId('review-warnings')).not.toBeInTheDocument();
  });

  /**
   * `F-018`. `GET /jobs/{id}` publishes no field an import outcome fits in,
   * so the count lives only in the memory of the tab that watched the job
   * finish. A reload has to leave a correct screen, not a wrong number.
   */
  it('is correct without the count rather than guessing at one', () => {
    renderGate();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.Onboarding.reviewTitle);
    expect(screen.queryByTestId('review-warnings')).not.toBeInTheDocument();
  });
});
