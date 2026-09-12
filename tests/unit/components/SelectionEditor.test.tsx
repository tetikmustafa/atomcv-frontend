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
import { server } from '@/mocks/node';
import { useAnnouncerStore } from '@/stores/announcerStore';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';
import type { components } from '@/types/api';

type AcceptedJob = components['schemas']['AcceptedJobResponse'];
type SelectionView = components['schemas']['SelectionViewResponse'];

const push = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    className?: string;
    'data-testid'?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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

/** Every selection edit that went out, as the server received it. */
let sent: unknown[] = [];

async function record({ request }: { request: Request }) {
  if (request.method === 'POST' && request.url.includes('/selection')) {
    sent.push(await request.clone().json());
  }
}

beforeEach(() => {
  push.mockClear();
  sent = [];
  useAnnouncerStore.getState().clear();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  server.events.on('request:start', record);
  return () => server.events.removeListener('request:start', record);
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

/** The lines the server published, so the screen can be checked against them. */
async function linesOf(generationId: string) {
  const view = await api.get<SelectionView>(`/generations/${generationId}/selection`);
  return view.lines ?? [];
}

/** Opens the panel and waits for the list to arrive. */
async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: en.Result.selectionOpen }));
  await waitFor(() => expect(screen.getAllByRole('switch').length).toBeGreaterThan(0));
}

/**
 * Faz G's hand toggle (§ 24.4, `B-088` and `B-097`).
 *
 * What is worth pinning is not that switches render. It is that the screen is
 * drawn from **what this generation weighed** — the list that makes every
 * button on it pressable — and that a press sends only what actually moved.
 */
describe('choosing the lines by hand', () => {
  /**
   * The list is a second request and most readers never look at it. Asserted
   * on the request itself: "no switches yet" would also pass on a query that
   * ran and whose answer was thrown away.
   */
  it('asks for nothing until the panel is opened', async () => {
    const generationId = await generate();
    const user = userEvent.setup();
    const asked: string[] = [];

    function watch({ request }: { request: Request }) {
      if (request.method === 'GET' && request.url.endsWith('/selection')) asked.push(request.url);
    }

    server.events.on('request:start', watch);

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });

    expect(
      await screen.findByRole('button', { name: en.Result.selectionOpen }),
    ).toBeInTheDocument();
    expect(asked).toHaveLength(0);

    await openPanel(user);
    expect(asked).toHaveLength(1);

    server.events.removeListener('request:start', watch);
  });

  /**
   * The order is the server's answer — on the page first, then what the page
   * budget held back — and the text is what this CV printed. Both are
   * asserted against the endpoint rather than against a fixed arrangement, so
   * a change to the profile fixture cannot make this test agree with a screen
   * that is wrong.
   */
  it('draws the lines in the order they were published, with their own wording', async () => {
    const generationId = await generate();
    const lines = await linesOf(generationId);
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });
    await openPanel(user);

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(lines.length);

    lines.forEach((line, index) => {
      expect(switches[index]).toHaveAccessibleName(line.text!);
      expect(switches[index]).toHaveAttribute('aria-checked', String(line.onPage === true));
    });
  });

  /**
   * Rule 6: the switch's position and the words under it are the same fact,
   * and the second is the one a reader who cannot see the switch gets.
   */
  it('says whether a line is on the page in words as well', async () => {
    const generationId = await generate();
    const lines = await linesOf(generationId);
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });
    await openPanel(user);

    const onPage = lines.filter((line) => line.onPage === true).length;
    expect(screen.getAllByText(en.Result.selectionOnPage).length).toBe(onPage);
    expect(screen.getAllByText(en.Result.selectionHeldBack).length).toBe(lines.length - onPage);
  });

  /** And a switch moving is announced with the line it moved. */
  it('announces the line that moved, not just that something did', async () => {
    const generationId = await generate();
    const lines = await linesOf(generationId);
    const held = lines.find((line) => line.onPage !== true)!;
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });
    await openPanel(user);

    await user.click(screen.getByRole('switch', { name: held.text! }));

    expect(useAnnouncerStore.getState().announcement?.message).toBe(
      en.Result.selectionOn.replace('{line}', held.text!),
    );
  });

  /**
   * **Only what moved.** A switch pressed twice is back where the server put
   * it, and sending it would ask the server to change something to itself —
   * which answers 202 and hands back the same document, the one outcome
   * § 24.4 refuses to produce.
   */
  it('sends the lines that moved, and nothing else', async () => {
    const generationId = await generate();
    const lines = await linesOf(generationId);
    const held = lines.find((line) => line.onPage !== true)!;
    const printed = lines.find((line) => line.onPage === true)!;
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });
    await openPanel(user);

    // On, then off again: back where it started, so it is not a change.
    await user.click(screen.getByRole('switch', { name: printed.text! }));
    await user.click(screen.getByRole('switch', { name: printed.text! }));
    await user.click(screen.getByRole('switch', { name: held.text! }));

    expect(screen.getByTestId('selection-changed')).toHaveTextContent('One line changed.');

    await user.click(screen.getByRole('button', { name: en.Result.selectionSubmit }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ include: [held.atomId] });
  });

  /**
   * Nothing moved is nothing to send, and a button that answers 400 is worse
   * than one that is plainly not ready to be pressed.
   */
  it('cannot be sent until something has moved', async () => {
    const generationId = await generate();
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });
    await openPanel(user);

    expect(screen.getByRole('button', { name: en.Result.selectionSubmit })).toBeDisabled();

    await user.click(screen.getAllByRole('switch')[0]!);

    expect(screen.getByRole('button', { name: en.Result.selectionSubmit })).toBeEnabled();
  });

  /**
   * The rule the whole of Faz G rests on: an edit is **not** local UI state.
   * The answer is a new generation and the screen leaves for it.
   */
  it('leaves for the generation the toggle made', async () => {
    const generationId = await generate();
    const lines = await linesOf(generationId);
    const held = lines.find((line) => line.onPage !== true)!;
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });
    await openPanel(user);

    await user.click(screen.getByRole('switch', { name: held.text! }));
    await user.click(screen.getByRole('button', { name: en.Result.selectionSubmit }));

    await waitFor(() => expect(push).toHaveBeenCalled(), { timeout: 10_000 });

    const [destination] = push.mock.calls[0]!;
    expect(destination).toMatch(/^\/generations\//);
    expect(destination).not.toBe(`/generations/${generationId}`);
  }, 15_000);

  /** It costs nothing, and that is the difference from the box above it. */
  it('says it costs nothing', async () => {
    const generationId = await generate();
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: Wrapper });
    await openPanel(user);

    expect(screen.getByText(en.Result.selectionCost)).toBeInTheDocument();
  });

  it('has no accessibility violations with the list open', async () => {
    const generationId = await generate();
    const user = userEvent.setup();

    const { container } = render(<GenerationResult generationId={generationId} />, {
      wrapper: Wrapper,
    });
    await openPanel(user);

    expect(await axe(container)).toHaveNoViolations();
  });
});
