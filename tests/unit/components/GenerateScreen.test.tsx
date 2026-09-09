import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerateScreen } from '@/components/generation/GenerateScreen';
import { failNextJob, gateRefusal } from '@/mocks/generationFixture';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
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

/**
 * Pasted, not typed, and not only because it is what the screen asks for.
 * `user.type` sends one event per character: a real posting is a few hundred
 * of them, which runs past the 5s timeout — and a test that dies mid-`type`
 * leaves a half-written posting to be refused as `too_short` and a late POST
 * to land in the *next* test's `bodies`. Both were measured here.
 */
async function submitPosting(posting?: string) {
  const user = userEvent.setup();
  render(<GenerateScreen />, { wrapper });

  if (posting) {
    await user.click(screen.getByLabelText('Job posting'));
    await user.paste(posting);
  }
  await user.click(screen.getByRole('button', { name: 'Generate' }));

  return user;
}

/**
 * The panel a *stream* failure draws, which is not the one a 4xx draws.
 *
 * The preflight answers the POST, so its panel is there within a tick. § 18.4's
 * gate runs after Faz A, so its panel waits on the job's own clock — the mock
 * lands the terminal event at `TERMINAL_AT`, past `findBy`'s default second.
 */
function findFailurePanel() {
  return screen.findByRole('alert', {}, { timeout: 5_000 });
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

    // The sentence is the one for *this* refusal, not a generic one: three
    // words is `too_short`, and § 18.1's four measurements each say something
    // the others do not (`B-043`).
    expect(panel).toHaveTextContent('too short to work from');
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

/**
 * `B-043`. Two refusals, one code, and they do not arrive the same way: the
 * preflight answers the POST, while § 18.4's gate runs after Faz A and comes
 * back over the **stream**. What the user is told, and what they are offered,
 * differ because what was refused differs — their text, or our reading of it.
 */
describe('a posting the gate refuses after reading it', () => {
  /** Long enough and signalled enough to get past § 18.1's preflight. */
  const REAL_POSTING = [
    'We are seeking a senior backend engineer to join a small platform team.',
    'Responsibilities: designing services, operating them in production, and',
    'mentoring the engineers around you. Requirements: several years of Java,',
    'PostgreSQL, container orchestration and a habit of writing things down.',
    'Preferred qualifications include message queues and infrastructure as code.',
  ].join(' ');

  it('offers what the server sent, which is two buttons and not three', async () => {
    failNextJob(gateRefusal('low_confidence'));
    await submitPosting(REAL_POSTING);

    const panel = await findFailurePanel();
    const offered = within(panel)
      .getAllByRole('button')
      .map((button) => button.textContent);

    // `continue_anyway` is gone from gate refusals, and its absence is the
    // point: acknowledging the preflight cannot help with a refusal that
    // happened after the preflight already passed. A screen that drew three
    // fixed buttons would still be offering it.
    expect(offered).toEqual(['Paste the full posting', 'Build a general resume instead']);
    expect(offered).not.toContain('Continue anyway');
  }, 10_000);

  it('tells the user their own text is fine when the model’s answer was not', async () => {
    failNextJob(gateRefusal('suspicious_output'));
    await submitPosting(REAL_POSTING);

    const panel = await findFailurePanel();

    // The gate refused our reading, not their paste. Sending them back to
    // rewrite a posting that is perfectly good is the wrong instruction.
    expect(panel).toHaveTextContent(/nothing is wrong with what you pasted/i);
    expect(panel).not.toHaveTextContent(/paste the whole advert/i);
  }, 10_000);

  it('retries the same request for a malformed reading', async () => {
    failNextJob(gateRefusal('suspicious_output'));
    const user = await submitPosting(REAL_POSTING);

    const panel = await findFailurePanel();
    await user.click(within(panel).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(bodies).toHaveLength(2));

    // Unchanged, and that is what makes it a way out rather than a loop: the
    // refused analysis is deliberately not cached, so asking again can come
    // back different (`B-043`).
    expect(await sent(1)).toMatchObject({ jobDescription: REAL_POSTING });
  }, 10_000);
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

describe('the two ways the server says not now', () => {
  it('offers no way out of a quota, because there is none', async () => {
    const { generations, QUOTA } = await import('@/mocks/generationFixture');
    generations.usage.generation = QUOTA.generation;

    await submitPosting();

    const panel = await screen.findByRole('alert');

    // The closed vocabulary has no "come back tomorrow", and `retry` would
    // say the opposite of the truth (`B-039`). What is left is the sentence.
    expect(within(panel).queryAllByRole('button')).toHaveLength(0);
    expect(panel).toHaveTextContent('every resume you can generate today');
  });

  it('says the brake is on without saying the account is gone', async () => {
    const { pauseGeneration } = await import('@/mocks/generationFixture');
    pauseGeneration();

    const user = await submitPosting();
    const panel = await screen.findByRole('alert');

    // § 44.3: generation stops, data access does not. The sentence has to
    // leave the profile out of it.
    expect(panel).toHaveTextContent('Generation is paused');
    expect(panel).toHaveTextContent('read, edit and export');

    pauseGeneration(false);
    await user.click(within(panel).getByRole('button', { name: 'Try again' }));

    // `retry` here means exactly what it says: nothing about the request was
    // wrong, so the same one is sent again.
    await waitFor(() => expect(bodies).toHaveLength(2));
    await screen.findByRole('progressbar');
  });
});

describe('the covering letter', () => {
  /**
   * Off by default, like the server's own default (`B-056`): a second LLM
   * call, and most people want a resume. Stated in the body either way, so a
   * request that did not ask for one says so.
   */
  it('is not asked for unless the reader asks', async () => {
    await submitPosting();

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(await sent(0)).toMatchObject({ coverLetter: false });
  });

  it('is asked for when the control is on', async () => {
    signIn();
    const user = userEvent.setup();
    render(<GenerateScreen />, { wrapper });

    // Found rather than got: the switch waits for the session, because a
    // control that appears and then vanishes can be pressed in between.
    await user.click(await screen.findByRole('switch', { name: 'Write a covering letter too' }));
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(await sent(0)).toMatchObject({ coverLetter: true });
  });

  /**
   * § 35.7.3 (`B-082`): the box is an account's. Hidden rather than disabled,
   * for the reason the atom controls are — a greyed-out switch beside the
   * primary action is an upsell in the middle of somebody's work — and
   * replaced by the sentence that says where it went.
   */
  it('is not offered at all without an account', async () => {
    render(<GenerateScreen />, { wrapper });

    // Substring, because the sentence ends in a link: the paragraph's text is
    // the note plus the invitation, and neither half is the whole node.
    expect(
      await screen.findByText(en.Generation.coverLetterAccount, { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Write a covering letter too' }),
    ).not.toBeInTheDocument();
  });

  it('asks for no letter in the body it sends without an account', async () => {
    await submitPosting();

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(await sent(0)).toMatchObject({ coverLetter: false });
  });
});

/**
 * § 35.7.4 (`B-083`). The unit suite runs with Cloudflare's always-passing
 * test key configured, so the widget is a real one — see `vitest.config.mts`.
 */
describe('the challenge', () => {
  it('is drawn for a caller without an account', async () => {
    render(<GenerateScreen />, { wrapper });

    expect(await screen.findByTestId('turnstile')).toBeInTheDocument();
  });

  it('is not drawn for an account, which answered one to sign in', async () => {
    signIn();
    render(<GenerateScreen />, { wrapper });

    // Awaited on something that does appear, so this is not asserting on a
    // render that has not happened yet.
    await screen.findByRole('switch', { name: 'Write a covering letter too' });
    expect(screen.queryByTestId('turnstile')).not.toBeInTheDocument();
  });

  it('sends the token the widget produced, and only where there is one', async () => {
    await submitPosting();

    await waitFor(() => expect(bodies).toHaveLength(1));
    // Nothing loads Cloudflare's script in jsdom, so no callback fires and
    // there is no token to send. Absent rather than empty is the assertion
    // that matters: the server reads an empty value as a **failed** challenge
    // (`B-083`), so a client that sent `''` would turn a deployment with the
    // challenge switched off into a wall.
    expect(await sent(0)).not.toHaveProperty('challengeToken');
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

/**
 * § 35.7.3 (`B-082`): the two anonymous hours can run out **during** a
 * generation, and the job is not retried. So the code arrives as a job
 * outcome and not only as an answer to the request — one shared renderer for
 * both transports, which is the whole reason there is no second
 * `switch (code)` anywhere.
 */
describe('a session that ends while the job is running', () => {
  it('says so from the stream, and offers the one way out the server sent', async () => {
    failNextJob({
      code: 'ANONYMOUS_SESSION_EXPIRED',
      resolutions: [{ action: 'sign_up' }],
    });
    await submitPosting();

    const panel = await findFailurePanel();
    expect(panel).toHaveTextContent(en.errors.ANONYMOUS_SESSION_EXPIRED);

    const offered = within(panel)
      .getAllByRole('button')
      .map((button) => button.textContent);
    // Nothing else: retrying is what the server refuses to do, and it did not
    // offer it.
    expect(offered).toEqual([en.resolutions.sign_up]);

    await userEvent.click(within(panel).getByRole('button', { name: en.resolutions.sign_up }));
    expect(push).toHaveBeenCalledWith('/login?next=%2Fgenerate');
  }, 10_000);
});
