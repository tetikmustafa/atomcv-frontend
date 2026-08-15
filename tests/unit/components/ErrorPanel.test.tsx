import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { ApiError, NetworkError } from '@/lib/api/errors';
import en from '@/messages/en.json';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}

const CONFLICT = new ApiError({
  status: 409,
  code: 'CONFLICTING_PREFERENCES',
  title: 'Pinned content exceeds the page limit',
  params: { pinnedPages: 2.3, maxPages: 1 },
  resolutions: [
    { action: 'increase_page_limit', params: { maxPages: 3 } },
    { action: 'review_pins' },
    { action: 'keep_top_pinned', params: { keep: 3 } },
  ],
});

describe('the error panel', () => {
  /**
   * Rule 7. The panel knows nothing about `CONFLICTING_PREFERENCES` — it
   * renders the list the server sent, which is why a code added tomorrow
   * still arrives with usable buttons.
   */
  it('turns the server’s resolutions into buttons, in the order they were sent', () => {
    render(<ErrorPanel error={CONFLICT} />, { wrapper });

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Allow 3 pages', 'Review pinned items', 'Keep the top 3']);
  });

  it('reports the action the user chose without interpreting it', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ErrorPanel error={CONFLICT} onResolve={onResolve} />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Review pinned items' }));

    expect(onResolve).toHaveBeenCalledWith({ action: 'review_pins' });
  });

  /** Rule 8: `title` is a developer string and is in the wrong language anyway. */
  it('shows the translated message, never the server’s title', () => {
    render(<ErrorPanel error={CONFLICT} />, { wrapper });

    expect(screen.getByRole('alert')).toHaveTextContent('one page');
    expect(screen.queryByText(/Pinned content exceeds/)).not.toBeInTheDocument();
  });

  /**
   * The action vocabulary is open. An unlabelled button on a screen the user
   * is already stuck on could do anything, and there is no way for them to
   * find out which — so it goes, and the ones we can name stay.
   */
  it('drops an action it cannot name and keeps the rest', () => {
    const error = new ApiError({
      status: 409,
      code: 'CONFLICTING_PREFERENCES',
      params: { pinnedPages: 2.3, maxPages: 1 },
      resolutions: [{ action: 'review_pins' }, { action: 'teleport_to_success' }],
    });

    render(<ErrorPanel error={error} />, { wrapper });

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Review pinned items' })).toBeInTheDocument();
  });

  /**
   * A code this build has never seen must still produce a panel with a
   * sentence in it. Throwing here would remove the explanation and every way
   * out at the same time.
   */
  it('still renders for a code it has never seen', () => {
    render(<ErrorPanel error={new ApiError({ status: 418, code: 'SOMETHING_NEW' })} />, {
      wrapper,
    });

    expect(screen.getByRole('alert')).toHaveTextContent(en.errors.UNEXPECTED_ERROR);
  });
});

describe('what the panel refuses to invent', () => {
  /**
   * "The frontend never invents resolutions." A request that never reached
   * the server has no server opinion about what to do next, so the row stays
   * empty — retry is the panel's own control and sits outside it.
   */
  it('offers no resolutions for a network failure', () => {
    render(<ErrorPanel error={new NetworkError()} />, { wrapper });

    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't reach the server");
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps its own retry and dismiss out of the resolution row', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    render(<ErrorPanel error={new NetworkError()} onRetry={onRetry} onDismiss={onDismiss} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

/**
 * The same failure arrives over two transports (Bölüm 30.6, 35.3). One
 * renderer handles both, so an error cannot look different depending on
 * whether it was refused before the job started or after.
 */
describe('an SSE failure', () => {
  it('renders identically to the synchronous refusal carrying the same code', () => {
    // What arrives on the stream is a plain JSON payload — no status, not an
    // `Error`, nothing that went through `fetch`. It has to be recognised by
    // shape, or the panel would call the whole thing an unexpected failure.
    const streamed = {
      code: 'CONFLICTING_PREFERENCES',
      params: { pinnedPages: 2.3, maxPages: 1 },
      resolutions: [{ action: 'review_pins' }],
    };

    const fromStream = render(<ErrorPanel error={streamed} />, { wrapper }).container.textContent;

    const fromResponse = render(<ErrorPanel error={new ApiError({ status: 409, ...streamed })} />, {
      wrapper,
    }).container.textContent;

    expect(fromStream).toContain('Review pinned items');
    expect(fromStream).toBe(fromResponse);
  });
});

describe('accessibility', () => {
  it('announces itself as an alert', () => {
    render(<ErrorPanel error={CONFLICT} />, { wrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has no violations', async () => {
    const { container } = render(
      <ErrorPanel error={CONFLICT} onRetry={() => {}} onDismiss={() => {}} />,
      { wrapper },
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
