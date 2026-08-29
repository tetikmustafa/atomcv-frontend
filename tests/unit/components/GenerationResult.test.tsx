import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationResult } from '@/components/generation/GenerationResult';
import { api } from '@/lib/api/client';
import { FIT_REPORT, generations, rejectNextCoverLetter } from '@/mocks/generationFixture';
import { server } from '@/mocks/node';
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
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : tr}>
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

    expect(await screen.findByTestId('cover-letter-rejected')).toHaveTextContent(
      "That draft didn't pass our own check",
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // And the way forward is the button that was already there.
    expect(screen.getByRole('button', { name: en.Result.coverLetterAsk })).toBeInTheDocument();
  });

  /**
   * The hourly allowance is its own limit, and `B-056` publishes only
   * `resetsAt` for it — no `Retry-After`. That is the branch the sentence has
   * for a wait it was not told the length of, and this is the only place
   * anything reaches it.
   */
  it('names no duration for a rate limit that sent no header', async () => {
    const generationId = await generate();
    generations.coverLetterAttempts = 10;
    render(<GenerationResult generationId={generationId} />, { wrapper: wrapperFor('en') });

    await userEvent.click(await screen.findByRole('button', { name: en.Result.coverLetterAsk }));

    const panel = await screen.findByRole('alert');
    expect(panel).toHaveTextContent('too many attempts');
    expect(panel).toHaveTextContent('try again shortly');
  });
});
