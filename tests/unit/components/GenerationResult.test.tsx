import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationResult } from '@/components/generation/GenerationResult';
import { api } from '@/lib/api/client';
import { submitFeedback } from '@/lib/api/endpoints/generations';
import { FIT_REPORT, generations, rejectNextCoverLetter } from '@/mocks/generationFixture';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';
import type { components } from '@/types/api';

type AcceptedJob = components['schemas']['AcceptedJobResponse'];

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => '/generations/gen-1',
}));

let client: QueryClient;

function wrapperFor(locale: 'en' | 'tr') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={locale === 'en' ? en : tr}
        formats={formats}
      >
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  };
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

/** A posting long enough and signalled enough to pass § 18.1's preflight. */
const POSTING = [
  'We are seeking a senior backend engineer to join a small platform team.',
  'Responsibilities: designing services, operating them in production, and',
  'mentoring the engineers around you. Requirements: several years of Java,',
  'PostgreSQL, container orchestration and a habit of writing things down.',
  'Preferred qualifications include message queues and infrastructure as code.',
].join(' ');

/** Makes a generation the way the product does, and returns its id. */
async function generate(body: Record<string, unknown> = { acknowledgePreflight: false }) {
  const job = await api.post<AcceptedJob>('/generations', body);
  return generations.jobs.find((candidate) => candidate.jobId === job.jobId)!.generationId;
}

describe('a finished generation', () => {
  it('reads the generation rather than the job that made it', async () => {
    const generationId = await generate({ jobDescription: POSTING, acknowledgePreflight: false });

    // No job was watched in this render — the cache holds nothing about it,
    // which is the state a reload lands in.
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await waitFor(() => expect(screen.getByText(/One page/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  /**
   * `B-094`. Two buttons on one endpoint, and the sentence beside them is not
   * decoration: \u00a7 22.6 makes the page limit approximate in Word, the backend
   * claims no page count for a DOCX, and this screen states one for the PDF
   * two lines above. Without the sentence the number reads as covering both.
   */
  it('offers Word beside the PDF, and says which of the two is exact', async () => {
    const generationId = await generate({ jobDescription: POSTING, acknowledgePreflight: false });
    const user = userEvent.setup();

    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await screen.findByRole('button', { name: 'Download PDF' });
    expect(screen.getByText(en.Result.formatNote)).toBeInTheDocument();

    const requested: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.endsWith('/download')) requested.push(url.search);
    });

    await user.click(screen.getByRole('button', { name: 'Download Word' }));

    // The format reaches the wire as the query the server reads. PDF omits it
    // rather than stating it, so a call written before the parameter existed
    // still means what it meant.
    await waitFor(() => expect(requested).toContain('?format=docx'));
  });

  it('shows countable facts and never a percentage', async () => {
    const generationId = await generate({ jobDescription: POSTING, acknowledgePreflight: false });

    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    const report = await screen.findByRole('region', { name: /matches the posting/i });

    expect(within(report).getByTestId('fit-required')).toHaveTextContent(
      `${FIT_REPORT.requiredCovered}/${FIT_REPORT.requiredTotal}`,
    );
    expect(within(report).getByTestId('fit-preferred')).toHaveTextContent(
      `${FIT_REPORT.preferredCovered}/${FIT_REPORT.preferredTotal}`,
    );

    // § 23.3 forbids one by name. Completeness is the opposite — a percentage
    // by design — and the two must not be unified.
    expect(report.textContent).not.toMatch(/%/);
    // Nor a ratio spelled out: nothing here divides one count by another.
    expect(report.textContent).not.toMatch(/\b\d+\.\d+\b/);
  });

  it('names the missing skills in the posting’s own words, split by weight', async () => {
    const generationId = await generate({ jobDescription: POSTING, acknowledgePreflight: false });

    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    const report = await screen.findByRole('region', { name: /matches the posting/i });

    // Two lists, not one: the counts say how many are missing on each side,
    // and merging the names would hide which gap costs the interview.
    const required = within(report).getByRole('heading', { name: 'Missing required skills' });
    const preferred = within(report).getByRole('heading', { name: 'Missing preferred skills' });

    expect(required).toBeInTheDocument();
    expect(preferred).toBeInTheDocument();
    // The advert said "mikroservis"; that is the word the reader is looking
    // for, not our canonical spelling of it.
    expect(within(report).getByText('mikroservis')).toBeInTheDocument();
    expect(within(report).getByText(/mikroservis experience/)).toBeInTheDocument();
  });

  it('says there was nothing to compare against in general mode', async () => {
    const generationId = await generate();

    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await waitFor(() => expect(screen.getByText(en.Result.generalNote)).toBeInTheDocument());
    // Not a row of zeroes: "0/0" reads as a bad match rather than as a
    // different question.
    expect(screen.queryByTestId('fit-required')).not.toBeInTheDocument();
  });

  it('translates the level rather than printing the wire value', async () => {
    const generationId = await generate({ jobDescription: POSTING, acknowledgePreflight: false });

    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('tr') });

    const level = await screen.findByTestId('fit-level');

    expect(level).toHaveTextContent('Orta eşleşme');
    expect(level).not.toHaveTextContent('MODERATE');
  });

  /**
   * `B-042`. `auto` resolves to the posting's language only when the profile
   * can actually be written in it; when it cannot, the document stays in the
   * profile's language and the two tags disagree. The reader pasted an
   * English posting and got a Turkish CV, so they are owed the reason.
   */
  describe('when the CV is not in the posting’s language', () => {
    it('says so, naming both languages in the reader’s own', async () => {
      const generationId = await generate({ jobDescription: POSTING, acknowledgePreflight: false });

      render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

      const note = await screen.findByTestId('language-note');

      // Rule 9: names, not tags. And in the interface language — the person
      // reading this screen is the user, not the recruiter.
      expect(note).toHaveTextContent('Turkish');
      expect(note).toHaveTextContent('English');
      expect(note.textContent).not.toMatch(/\b(tr|en)\b/);
    });

    it('names them in Turkish for a Turkish reader', async () => {
      const generationId = await generate({ jobDescription: POSTING, acknowledgePreflight: false });

      render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('tr') });

      const note = await screen.findByTestId('language-note');

      expect(note).toHaveTextContent('Türkçe');
      expect(note).toHaveTextContent('İngilizce');
    });

    it('stays quiet when the posting is in the language the CV came out in', async () => {
      // The same posting in Turkish: the gate reads it as Turkish, the profile
      // is Turkish, nothing diverged and there is nothing to explain.
      const turkish = [
        'Küçük bir platform ekibine kıdemli bir backend mühendisi arıyoruz.',
        'Sorumluluklar: servis tasarlamak, üretimde işletmek ve çevrenizdeki',
        'mühendislere mentorluk etmek. Gereksinimler: birkaç yıl Java deneyimi,',
        'PostgreSQL, konteyner orkestrasyonu ve yazılı iletişim alışkanlığı.',
        'Tercih edilen nitelikler mesaj kuyrukları ve kod olarak altyapıdır.',
      ].join(' ');

      const generationId = await generate({
        jobDescription: turkish,
        acknowledgePreflight: true,
      });

      render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

      await screen.findByRole('button', { name: 'Download PDF' });
      expect(screen.queryByTestId('language-note')).not.toBeInTheDocument();
    });

    it('stays quiet in general mode, where there was no posting to read', async () => {
      const generationId = await generate();

      render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

      await waitFor(() => expect(screen.getByText(en.Result.generalNote)).toBeInTheDocument());
      // `postingLanguage` is absent, not equal — a note comparing a language
      // against nothing would be drawn on every general CV.
      expect(screen.queryByTestId('language-note')).not.toBeInTheDocument();
    });
  });

  it('has no violations', async () => {
    const generationId = await generate({ jobDescription: POSTING, acknowledgePreflight: false });

    const { container } = render(<GenerationResult generationId={generationId} />, {
      wrapper: wrapperFor('en'),
    });

    await screen.findByRole('region', { name: /matches the posting/i });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('the covering letter', () => {
  /*
    As an account throughout. Both of these belong to one since § 35.7.3
    (`B-082`): `POST /generations` refuses the box, the regenerate endpoint
    refuses the button behind it, and `GET /generations/{id}` answers
    `feedback: null` for a caller without an account. What an anonymous reader
    sees instead has its own tests at the bottom of this file.
  */
  beforeEach(signIn);

  /**
   * § 34 keeps it off the main path: a second LLM call, and most people want
   * a resume. So a generation that did not ask for one arrives without a
   * letter, and the absence is a state with a control rather than an error.
   */
  it('offers to write one when none was asked for', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    expect(await screen.findByText(en.Result.coverLetterAbsent)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Result.coverLetterAsk })).toBeInTheDocument();
  });

  it('writes one on request, and keeps the blank lines it came with', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await userEvent.click(await screen.findByRole('button', { name: en.Result.coverLetterAsk }));

    const letter = await screen.findByTestId('cover-letter');
    // The blank line between parts is the letter's only structure (§ 34.7).
    expect(letter.textContent).toContain('\n\n');
    expect(letter).toHaveTextContent('Dear hiring team');
  });

  it('arrives with the resume when it was asked for up front', async () => {
    const generationId = await generate({ acknowledgePreflight: false, coverLetter: true });
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    expect(await screen.findByTestId('cover-letter')).toBeInTheDocument();
  });

  /**
   * `B-056`: a letter that could not be written **does not fail the job**. So
   * this state is a completed resume with no letter and a button — not an
   * error panel about a generation that succeeded.
   */
  it('leaves a resume whole when its letter could not be written', async () => {
    rejectNextCoverLetter();
    const generationId = await generate({ acknowledgePreflight: false, coverLetter: true });
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    expect(await screen.findByText(/One page/)).toBeInTheDocument();
    expect(screen.getByText(en.Result.coverLetterAbsent)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends the style the reader picked, and the note only when there is one', async () => {
    const bodies: Promise<string>[] = [];
    const capture = ({ request }: { request: Request }) => {
      if (request.url.includes('cover-letter')) bodies.push(request.clone().text());
    };
    server.events.on('request:start', capture);

    try {
      const generationId = await generate();
      render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

      await userEvent.click(await screen.findByRole('button', { name: en.Result.coverLetterAsk }));
      await screen.findByTestId('cover-letter');

      await userEvent.click(
        screen.getByRole('radio', { name: en.Result.coverLetterStyles.shorter }),
      );
      await userEvent.type(
        screen.getByLabelText(en.Result.coverLetterNote),
        'They ship on Fridays.',
      );
      await userEvent.click(screen.getByRole('button', { name: en.Result.coverLetterAnother }));

      await waitFor(() => expect(bodies).toHaveLength(2));
      expect(JSON.parse(await bodies[0]!)).toEqual({ style: 'default' });
      expect(JSON.parse(await bodies[1]!)).toEqual({
        style: 'shorter',
        companyNote: 'They ship on Fridays.',
      });
    } finally {
      server.events.removeListener('request:start', capture);
    }
  });

  /**
   * Each press replaces the stored letter (§ 34), so trying another draft
   * leaves one letter rather than three.
   */
  it('replaces the letter rather than adding to a list', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await userEvent.click(await screen.findByRole('button', { name: en.Result.coverLetterAsk }));
    await screen.findByTestId('cover-letter');
    await userEvent.click(screen.getByRole('button', { name: en.Result.coverLetterAnother }));

    await waitFor(() => expect(screen.getAllByTestId('cover-letter')).toHaveLength(1));
  });

  /**
   * `B-056` in one assertion. A letter has no original to fall back on, so a
   * draft that overstates is thrown away — the reader did nothing wrong and
   * there is nothing to fix. "This draft did not pass, try again" is the
   * sentence; a red panel is not.
   */
  it('does not dress a refused draft up as a fault', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    rejectNextCoverLetter();
    await userEvent.click(await screen.findByRole('button', { name: en.Result.coverLetterAsk }));

    const refusal = await screen.findByTestId('cover-letter-rejected');

    expect(refusal).toHaveTextContent("That draft didn't pass our own check");
    /*
      Both issues, named and joined by `Intl.ListFormat` — the body this
      asserts is the one measured off the wire on 2026-08-30, where the guard
      sent two. A refusal listing one of the two reasons would be a screen
      quietly dropping half of what it was told.
    */
    expect(refusal).toHaveTextContent(
      "a figure that isn't in your CV and a length that was well off",
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // And the way forward is the button that was already there.
    expect(screen.getByRole('button', { name: en.Result.coverLetterAsk })).toBeInTheDocument();
  });

  /**
   * The hourly allowance is its own limit, and its `429` carries
   * `Retry-After` like the two quota gates — which this screen used to say it
   * did not.
   *
   * The header was never missing (`B-062`): the advice derives it from any
   * 429 whose `resetsAt` is an instant. What was missing was the schema
   * publishing it and a test on the far side seeing it, and the absence of
   * those two reads exactly like the absence of the header. The mock and
   * this assertion both believed the reading.
   */
  it('names the wait from the header the endpoint does send', async () => {
    const generationId = await generate();
    generations.coverLetterAttempts = 10;
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await userEvent.click(await screen.findByRole('button', { name: en.Result.coverLetterAsk }));

    const panel = await screen.findByRole('alert');
    expect(panel).toHaveTextContent('too many attempts');
    expect(panel).toHaveTextContent('about 60 minutes');
  });
});

describe('the verdict on a generation', () => {
  /*
    As an account throughout. Both of these belong to one since § 35.7.3
    (`B-082`): `POST /generations` refuses the box, the regenerate endpoint
    refuses the button behind it, and `GET /generations/{id}` answers
    `feedback: null` for a caller without an account. What an anonymous reader
    sees instead has its own tests at the bottom of this file.
  */
  beforeEach(signIn);

  /**
   * § 48.4: a form that accepts the judgement before asking why collects more
   * of it and better of it. So the thumb is the whole required form, and the
   * rest appears only once it has been given.
   */
  it('asks nothing until the thumb has been pressed', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    expect(await screen.findByRole('button', { name: en.Result.feedbackGood })).toBeInTheDocument();
    expect(screen.queryByText(en.Result.feedbackMore)).not.toBeInTheDocument();
  });

  /**
   * One verdict per generation: the other thumb is a change of mind, not a
   * second row. So what is drawn is the current **selection**, which somebody
   * can look at and disagree with — not a thank-you.
   */
  it('shows which answer is standing, and lets it be changed', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    const yes = await screen.findByRole('button', { name: en.Result.feedbackGood });
    await userEvent.click(yes);

    await waitFor(() => expect(yes).toHaveAttribute('aria-pressed', 'true'));

    const no = screen.getByRole('button', { name: en.Result.feedbackBad });
    await userEvent.click(no);

    await waitFor(() => expect(no).toHaveAttribute('aria-pressed', 'true'));
    expect(yes).toHaveAttribute('aria-pressed', 'false');
  });

  /**
   * `contentGranted` is the one door to the content itself, and it is a
   * **switch**: `false` revokes. So every request states it, and a thumb
   * pressed after the window was opened must not close it by omission.
   */
  it('keeps the permission open when the verdict changes afterwards', async () => {
    const bodies: Promise<string>[] = [];
    const capture = ({ request }: { request: Request }) => {
      if (request.url.endsWith('/feedback')) bodies.push(request.clone().text());
    };
    server.events.on('request:start', capture);

    try {
      const generationId = await generate();
      render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

      await userEvent.click(await screen.findByRole('button', { name: en.Result.feedbackBad }));
      await userEvent.click(screen.getByText(en.Result.feedbackMore));
      await userEvent.click(screen.getByRole('checkbox'));

      await waitFor(() => expect(bodies).toHaveLength(2));

      await userEvent.click(screen.getByRole('button', { name: en.Result.feedbackGood }));
      await waitFor(() => expect(bodies).toHaveLength(3));

      expect(JSON.parse(await bodies[0]!)).toEqual({ rating: -1, contentGranted: false });
      expect(JSON.parse(await bodies[1]!)).toEqual({ rating: -1, contentGranted: true });
      // The third is the changed verdict, and the permission rides along.
      expect(JSON.parse(await bodies[2]!)).toEqual({ rating: 1, contentGranted: true });
    } finally {
      server.events.removeListener('request:start', capture);
    }
  });

  /**
   * A permission nobody can check up on is a checkbox. `accessedAt` is what
   * makes it something else, and it is `null` until somebody actually looks —
   * which is the state the sentence usually has to describe.
   */
  it('says the permission is open and that nobody has used it', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await userEvent.click(await screen.findByRole('button', { name: en.Result.feedbackGood }));
    await userEvent.click(screen.getByText(en.Result.feedbackMore));
    await userEvent.click(screen.getByRole('checkbox'));

    expect(await screen.findByTestId('grant-status')).toHaveTextContent('Nobody has looked yet');
  });

  /**
   * `rating` is `1 | -1` as a **number**. The generated request type renders
   * the enum as the string literals `"1" | "-1"`, and a string reaching a
   * field the server reads as an integer is the kind of thing that works
   * until it does not.
   */
  it('sends the rating as a number', async () => {
    const bodies: Promise<string>[] = [];
    const capture = ({ request }: { request: Request }) => {
      if (request.url.endsWith('/feedback')) bodies.push(request.clone().text());
    };
    server.events.on('request:start', capture);

    try {
      const generationId = await generate();
      render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

      await userEvent.click(await screen.findByRole('button', { name: en.Result.feedbackGood }));
      await waitFor(() => expect(bodies).toHaveLength(1));

      expect(typeof (JSON.parse(await bodies[0]!) as { rating: unknown }).rating).toBe('number');
    } finally {
      server.events.removeListener('request:start', capture);
    }
  });
});

/**
 * § 48.4: forty-eight hours **from the first yes**. A second yes does not push
 * the window along, which is the half of the rule that only a second request
 * can show — and the reason the endpoint is tested here rather than only
 * through the screen.
 */
describe('the diagnostic window', () => {
  /*
    As an account throughout. Both of these belong to one since § 35.7.3
    (`B-082`): `POST /generations` refuses the box, the regenerate endpoint
    refuses the button behind it, and `GET /generations/{id}` answers
    `feedback: null` for a caller without an account. What an anonymous reader
    sees instead has its own tests at the bottom of this file.
  */
  beforeEach(signIn);

  it('runs from the first consent, not from the latest one', async () => {
    const generationId = await generate();

    const first = await submitFeedback(generationId, { rating: -1, contentGranted: true });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await submitFeedback(generationId, { rating: 1, contentGranted: true });

    expect(first.contentGrant?.expiresAt).toBeTruthy();
    expect(second.contentGrant?.expiresAt).toBe(first.contentGrant?.expiresAt);
  });

  /** And `false` closes it outright rather than leaving it to lapse. */
  it('closes when the permission is taken back', async () => {
    const generationId = await generate();

    await submitFeedback(generationId, { rating: -1, contentGranted: true });
    const revoked = await submitFeedback(generationId, { rating: -1, contentGranted: false });

    expect(revoked.contentGrant).toBeUndefined();
  });
});

/**
 * `B-063`: `CoverLetterIssue` is an enum with exactly six values, so the
 * reasons a draft was thrown away can be said in words. Before this they
 * reached the reader as `unsupported_claim and cliche` — `Intl.ListFormat`
 * joins whatever it is handed.
 */
describe('why a draft was refused', () => {
  /*
    As an account throughout. Both of these belong to one since § 35.7.3
    (`B-082`): `POST /generations` refuses the box, the regenerate endpoint
    refuses the button behind it, and `GET /generations/{id}` answers
    `feedback: null` for a caller without an account. What an anonymous reader
    sees instead has its own tests at the bottom of this file.
  */
  beforeEach(signIn);

  it('names the reasons instead of printing their tokens', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    rejectNextCoverLetter();
    await userEvent.click(await screen.findByRole('button', { name: en.Result.coverLetterAsk }));

    const note = await screen.findByTestId('cover-letter-rejected');
    expect(note).toHaveTextContent("a figure that isn't in your CV");
    expect(note).not.toHaveTextContent('number_invented');
  });
});

/**
 * `B-065`: the verdict lives on the generation now, so a reload shows the
 * thumb that was pressed — and, the half that matters, the forty-eight hour
 * grant stays visible on the day somebody would actually check `accessedAt`.
 */
describe('a verdict given earlier', () => {
  /*
    As an account throughout. Both of these belong to one since § 35.7.3
    (`B-082`): `POST /generations` refuses the box, the regenerate endpoint
    refuses the button behind it, and `GET /generations/{id}` answers
    `feedback: null` for a caller without an account. What an anonymous reader
    sees instead has its own tests at the bottom of this file.
  */
  beforeEach(signIn);

  it('comes back on a fresh render of the screen', async () => {
    const generationId = await generate();
    await submitFeedback(generationId, { rating: -1, contentGranted: true });

    // A new client with nothing in it: this is the reload, not the tab that
    // pressed the button.
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    const no = await screen.findByRole('button', { name: en.Result.feedbackBad });
    expect(no).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: en.Result.feedbackGood })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('still shows the permission, and that nobody has used it', async () => {
    const generationId = await generate();
    await submitFeedback(generationId, { rating: 1, contentGranted: true });

    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await userEvent.click(await screen.findByText(en.Result.feedbackMore));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByTestId('grant-status')).toHaveTextContent('Nobody has looked yet');
  });

  /** Nothing is claimed about a generation nobody has judged. */
  it('says nothing when there is no verdict', async () => {
    const generationId = await generate();
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    const yes = await screen.findByRole('button', { name: en.Result.feedbackGood });
    expect(yes).toHaveAttribute('aria-pressed', 'false');
  });
});

/**
 * What the result screen is without an account (§ 35.7.3, § 35.7.2,
 * `B-082`).
 *
 * The resume itself is the whole product and it is untouched — built,
 * measured and downloadable exactly as it would be. What is missing is the
 * two things that need somebody who can still be reached tomorrow: a letter,
 * and a verdict with a 48-hour window on the content behind it.
 */
describe('the same result without an account', () => {
  it('says where the covering letter went, and offers no way to ask for one', async () => {
    const generationId = await generate();

    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    expect(await screen.findByTestId('cover-letter-account')).toHaveTextContent(
      en.Result.coverLetterAccount,
    );
    expect(
      screen.queryByRole('button', { name: en.Result.coverLetterAsk }),
    ).not.toBeInTheDocument();
  });

  it('draws no verdict form, because there is no verdict to give', async () => {
    const generationId = await generate();

    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    // Awaited on the resume, so this is not asserting on a render that has
    // not happened yet.
    await screen.findByRole('button', { name: 'Download PDF' });
    expect(screen.queryByRole('button', { name: en.Result.feedbackGood })).not.toBeInTheDocument();
  });

  it('still downloads the resume, which is the part that is not narrower', async () => {
    const generationId = await generate();

    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    expect(await screen.findByRole('button', { name: 'Download PDF' })).toBeEnabled();
  });
});
