import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerateScreen } from '@/components/generation/GenerateScreen';
import { server } from '@/mocks/node';
import en from '@/messages/en.json';

const push = vi.fn();
const replace = vi.fn();

/**
 * next-intl's navigation reaches for the App Router, which jsdom has none of.
 * Only the calls matter here — that a resolution pointing at the profile
 * navigates rather than silently doing nothing.
 */
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push, replace }),
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => '/generate',
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

/** Every body sent to `POST /generations`, in order. */
let bodies: Promise<string>[] = [];

function captureBodies({ request }: { request: Request }) {
  if (request.method === 'POST' && request.url.endsWith('/generations')) {
    bodies.push(request.clone().text());
  }
}

async function sent(index: number) {
  return JSON.parse(await bodies[index]!) as Record<string, unknown>;
}

beforeEach(() => {
  bodies = [];
  push.mockClear();
  server.events.on('request:start', captureBodies);
});

afterEach(() => {
  server.events.removeListener('request:start', captureBodies);
});

const NOT_A_POSTING = 'hire someone good';

async function submitPosting(posting?: string) {
  const user = userEvent.setup();
  render(<GenerateScreen />, { wrapper });

  if (posting) await user.type(screen.getByLabelText('Job posting'), posting);
  await user.click(screen.getByRole('button', { name: 'Generate' }));

  return user;
}

describe('starting a generation', () => {
  it('sends no posting at all when the field is empty', async () => {
    await submitPosting();

    await waitFor(() => expect(bodies).toHaveLength(1));
    // The absence of a posting is general mode (§ 35.3). An empty string
    // would have been accepted too; what must not appear is a field the user
    // never filled in being sent as if they had.
    expect(await sent(0)).not.toHaveProperty('jobDescription');
  });

  it('offers the three ways out of a refused posting, in the order sent', async () => {
    await submitPosting(NOT_A_POSTING);

    const panel = await screen.findByRole('alert');
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);

    expect(panel).toHaveTextContent('make sense of that job posting');
    expect(buttons).toEqual([
      'Continue anyway',
      'Paste the full posting',
      'Build a general resume instead',
      // The form's own submit, outside the resolution row.
      'Generate',
    ]);
  });

  it('acknowledges the preflight rather than repeating the request', async () => {
    const user = await submitPosting(NOT_A_POSTING);

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Continue anyway' }));

    await waitFor(() => expect(bodies).toHaveLength(2));

    // The same text, and the flag that makes the difference. Sending it
    // unchanged would be refused identically — a loop, not a way out.
    expect(await sent(1)).toMatchObject({
      jobDescription: NOT_A_POSTING,
      acknowledgePreflight: true,
    });
  });

  it('drops the posting when the user takes the general resume instead', async () => {
    const user = await submitPosting(NOT_A_POSTING);

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Build a general resume instead' }));

    await waitFor(() => expect(bodies).toHaveLength(2));

    // Blank, which the schema says means the same as omitted. What matters
    // is that the text the preflight refused is not sent again.
    expect(await sent(1)).toMatchObject({ jobDescription: '', acknowledgePreflight: false });
  });

  it('shows the progress bar once a job is accepted', async () => {
    await submitPosting();

    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});

describe('a refusal this screen cannot act on itself', () => {
  it('sends the user to the profile when the profile is what is empty', async () => {
    const { fixture } = await import('@/mocks/profileFixture');
    fixture.atoms.length = 0;

    const user = await submitPosting();

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Open the profile editor' }));

    expect(push).toHaveBeenCalledWith('/profile');
  });
});

describe('accessibility', () => {
  it('has no violations, as a form or as a running job', async () => {
    const { axe } = await import('jest-axe');
    const user = userEvent.setup();
    const { container } = render(<GenerateScreen />, { wrapper });

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Generate' }));
    await screen.findByRole('progressbar');

    // Axe cannot tell you the bar is announced — that is the live region's
    // job, and the e2e suite is where it is asserted. What it can tell you is
    // that the bar has a name and a range at all.
    expect(await axe(container)).toHaveNoViolations();
  });
});
