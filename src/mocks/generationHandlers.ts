/**
 * Stage 2 generation endpoints, rewritten against the published schema and
 * checked frame by frame against the running backend on 2026-08-24.
 *
 * What they encode is behaviour, not example bodies:
 *
 * - the preflight refuses **synchronously**, with the three ways out § 18.1
 *   names, and `acknowledgePreflight` is how the user insists (`B-037`);
 * - the gates run cheapest first — the brake before the quota, the quota
 *   before either preflight (§ 35.3, § 44.3);
 * - a stream opens with a snapshot, so a client that subscribes after the
 *   job has already finished still gets its outcome;
 * - a terminal event closes the stream, and `GET /jobs/{id}` reconciles a
 *   stream that closed without one.
 *
 * The one shape that is *not* measured is a running job's `GET /jobs/{id}`
 * body: only the completed one was observed. Its fields are the schema's.
 */

import { http, HttpResponse } from 'msw';
import type { JobStatus } from '@/lib/api/endpoints/jobs';
import type { components } from '@/types/api';
import type { CompletedEvent, FailedEvent, PhaseEvent } from './contracts';
import { problem } from './problem';
import { fixture } from './profileFixture';
import {
  claimCoverLetterRejection,
  COVER_LETTER_LIMIT,
  coverLetterText,
  FIT_REPORT,
  generations,
  jobSnapshot,
  metricFor,
  phasesAfter,
  TERMINAL_AT,
  type MockJob,
} from './generationFixture';
import { currentQuota } from './sessionFixture';

type Schemas = components['schemas'];

/**
 * A job's body, with the warning code re-opened.
 *
 * The client's own read type rather than a second declaration of it: the
 * schema's enum is documentation for a field the server stores as a `String`
 * (`B-069`), and a mock held to the closed union could not send the one thing
 * the open reading exists for.
 */
type JobStatusBody = JobStatus;
type GenerationRequest = Schemas['GenerationRequest'];
type CoverLetterRequest = Schemas['CoverLetterRequest'];

const GENERATIONS = '/api/v1/generations';

/**
 * § 18.1's signal vocabulary, both languages. At least **two distinct**
 * signals are wanted: a posting that writes "experience" nine times has said
 * one thing, not nine.
 */
const SIGNAL_WORDS = [
  'sorumluluk',
  'aranan',
  'nitelik',
  'deneyim',
  'pozisyon',
  'ekip',
  'başvuru',
  'yetkinlik',
  'görev',
  'beklenen',
  'tercihen',
  'çalışma',
  'responsibilities',
  'requirements',
  'qualifications',
  'experience',
  'role',
  'team',
  'apply',
  'skills',
  'duties',
  'preferred',
  'seeking',
  'position',
];

/**
 * § 18.1's four measurements, in its order — length before entropy, so a long
 * repetitive paste is refused for what it is rather than for being repetitive.
 *
 * Modelled on the rule rather than on a magic string: a mock that refused
 * `'bad posting'` would let the client believe every other text passes, and
 * the first real paste would prove otherwise.
 *
 * Returns **which** measurement refused (`B-043`), not merely that one did.
 * The order is the rule's, so the reason a text gets is the first thing
 * actually wrong with it — and `null` means it passed.
 */
function preflightRefusal(text: string): string | null {
  if (text.length > 20_000) return 'too_long';

  // `toLowerCase` with no locale: this is a wire vocabulary, not user text,
  // and the Turkish locale folds `I` to a dotless `ı` — after which
  // `qualifications` never matches again (rule 11).
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  if (words.length < 40) return 'too_short';
  if (new Set(words).size / words.length < 0.15) return 'low_entropy';
  if (new Set(words.filter((word) => SIGNAL_WORDS.includes(word))).size < 2) {
    return 'not_job_like';
  }

  return null;
}

/**
 * Which language Faz A would read this posting as — as far as a mock can say.
 *
 * Standing in for a model with one signal that is actually decisive between
 * the two languages the product ships in: the letters Turkish has and English
 * does not. That is enough for the case `B-042` exists for, and it is honest
 * about being a stand-in rather than pretending to detect a language.
 */
function looksEnglish(text: string): boolean {
  return !/[çğıöşü]/i.test(text);
}

function sseFrame(event: string, data: unknown, id: number) {
  return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * A minimal but genuinely valid PDF, offsets computed rather than guessed —
 * the download button in the dev harness opens a real viewer, and a broken
 * file there looks like a bug in the client.
 */
function onePagePdf(): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const startxref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return new TextEncoder().encode(body);
}

/**
 * A row's place in the history, as an opaque string.
 *
 * The **whole** sort key, not just the instant: two generations made in the
 * same millisecond are ordered by id, and a cursor carrying only the time
 * would either skip the rest of that group or hand it out twice. Base64 so
 * nothing is tempted to read it — the client's job is to echo it back.
 */
function historyCursor(job: MockJob): string {
  return btoa(`${job.startedAt}|${job.generationId}`);
}

/** § 48.4: the diagnostic window, from the first yes. */
const GRANT_HOURS = 48;

/**
 * The verdict as the API returns it, built in one place.
 *
 * Two endpoints hand back this same object — the write answers with it, and
 * `GET /generations/{id}` carries it in `feedback` (`B-065`) — and the second
 * one is what makes the grant visible the day after it was given. Building it
 * twice would be two chances for the read to disagree with the write about a
 * permission somebody is checking up on.
 *
 * `undefined` when nobody has judged it: the field is then **absent** from the
 * generation rather than present and empty, because an empty verdict is not a
 * neutral one.
 */
function feedbackBody(generationId: string): Schemas['FeedbackResponse'] | undefined {
  const record = generations.feedback[generationId];
  if (!record) return undefined;

  return {
    generationId,
    rating: record.rating,
    ...(record.category ? { category: record.category } : {}),
    ...(record.grantedAt
      ? {
          contentGrant: {
            open: true,
            expiresAt: new Date(record.grantedAt + GRANT_HOURS * 60 * 60 * 1000).toISOString(),
          },
        }
      : {}),
    // The comment is never echoed (rule 4's reason: the person wrote it and
    // has it). Nothing here stores it either.
  };
}

/** An hour from now — § 34 counts letters by the hour, not by the day. */
function inAnHour(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

/**
 * The next UTC midnight, which is 03:00 in Turkey (`F-007`).
 *
 * Exported for the import handler, which quotes the same instant for the same
 * reason — one renewal time, not two that drift apart by a millisecond.
 */
export function resetsAt(): string {
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString();
}

export const generationHandlers = [
  http.post('*/api/v1/generations', async ({ request }) => {
    const body = ((await request.json()) ?? {}) as GenerationRequest;

    // Idempotency first: the same key from the same user means the caller
    // asked for one generation and one exists (§ 30.7). Not a conflict.
    const key = request.headers.get('Idempotency-Key');
    const existing = key ? generations.jobs.find((job) => job.idempotencyKey === key) : undefined;
    if (existing) return accepted(existing);

    // § 44.3: the brake runs ahead of the quota, so a paused deployment does
    // not spend anyone's allowance on a request it is going to refuse.
    if (generations.paused) {
      return HttpResponse.json(
        problem(503, 'GENERATION_PAUSED', GENERATIONS, [{ action: 'retry' }]),
        { status: 503 },
      );
    }

    if (generations.usage.generation >= currentQuota().generation) {
      const at = resetsAt();

      // The refusal takes a unit too, and that is the point: without it a
      // user past their limit could hammer the endpoint for free (`B-040`).
      // Measured — a preflight refusal (422) does **not** take one, so this
      // increment belongs to the quota gate rather than to the request.
      generations.usage.generation += 1;

      return HttpResponse.json(
        // No resolutions, deliberately: the closed vocabulary has no "come
        // back tomorrow", and `retry` would say the opposite of the truth
        // (`B-039`).
        problem(429, 'QUOTA_EXCEEDED', GENERATIONS, [], { metric: 'generation', resetsAt: at }),
        {
          status: 429,
          // Both, and not redundant: `resetsAt` is the absolute instant the
          // sentence is written from, `Retry-After` is the only value that
          // survives a client whose clock is wrong.
          headers: { 'Retry-After': String(Math.ceil((Date.parse(at) - Date.now()) / 1000)) },
        },
      );
    }

    const jobDescription = body.jobDescription?.trim() ?? '';

    const refusal = body.acknowledgePreflight ? null : preflightRefusal(jobDescription);

    if (jobDescription !== '' && refusal) {
      return HttpResponse.json(
        problem(
          422,
          'UNPARSEABLE_JOB_DESCRIPTION',
          GENERATIONS,
          // The spec's order: insist, fix the text, or drop the posting. All
          // three survive here and only here — `continue_anyway` skips the
          // preflight, so it is meaningless once the preflight has passed
          // (`B-043`).
          [
            { action: 'continue_anyway' },
            { action: 'paste_full_posting' },
            { action: 'continue_as_general_cv' },
          ],
          // `reason` says which of § 18.1's four measurements refused. The
          // other two still travel — the catalogue declares them — but both
          // are zero here, because the preflight analysed nothing. Reading
          // the sentence off `skillsFound` alone was how "no skills came out
          // of it" ended up accidentally true rather than true by rule.
          { reason: refusal, confidence: 0, skillsFound: 0 },
        ),
        { status: 422 },
      );
    }

    if (fixture.atoms.length === 0) {
      return HttpResponse.json(
        problem(422, 'INSUFFICIENT_PROFILE', GENERATIONS, [{ action: 'complete_profile' }], {
          completeness: fixture.profile.completeness ?? 0,
          missing: ['atoms'],
        }),
        { status: 422 },
      );
    }

    const job: MockJob = {
      jobId: `job-${generations.jobs.length + 1}`,
      kind: 'generation',
      generationId: `gen-${generations.jobs.length + 1}`,
      // No posting, no report: § 23.3's counts are counts *against a posting*
      // (`B-041`).
      ...(jobDescription === '' ? {} : { fitReport: FIT_REPORT }),
      /*
        B-042. The mock profile is Turkish, so a posting the gate reads as
        English produces the case worth encoding: the document stays in the
        profile's language and the two tags disagree. General mode has no
        posting to read a language off, so only `contentLanguage` survives —
        and the note must not be drawn there.

        The language is guessed from the posting the way a mock may: this
        stands in for Faz A, which is the only thing that really knows.
      */
      contentLanguage: 'tr',
      ...(jobDescription === ''
        ? {}
        : { postingLanguage: looksEnglish(jobDescription) ? 'en' : 'tr' }),
      /*
        `B-070`'s two labels, and a stand-in in the same sense the language
        guess above is one: reading a role and a company out of a posting is
        Faz A's work, and a mock that pattern-matched for it would be inventing
        an analysis rather than encoding a behaviour. What is real here is the
        **shape** — both present only when there was a posting, and absent
        rather than empty otherwise.
      */
      ...(jobDescription === ''
        ? {}
        : { roleTitle: 'Senior Backend Engineer', companyName: 'Acme' }),
      startedAt: Date.now(),
      outcome: generations.nextOutcome,
      ...(generations.nextFailure ? { failure: generations.nextFailure } : {}),
      ...(key ? { idempotencyKey: key } : {}),
    };

    generations.jobs.push(job);

    /*
      `coverLetter: true` asks for one alongside the CV, and a letter that
      could not be written **does not fail the job** (`B-056`). So this can
      leave a completed generation with no letter — which is not an error
      state but one the result screen has a button for.
    */
    if (body.coverLetter && !claimCoverLetterRejection()) {
      generations.coverLetters[job.generationId] = {
        text: coverLetterText('default'),
        style: 'default',
      };
    }

    // Both claimed here, together: the outcome and the error that goes with
    // it belong to this job now, and a request queued after it must not
    // inherit either.
    generations.nextOutcome = 'completed';
    generations.nextFailure = undefined;
    // Charged on enqueue and given back when a job fails (`B-039`); the
    // refund is in the stream, where the outcome is known.
    generations.usage.generation += 1;

    return accepted(job);
  }),

  http.get('*/api/v1/jobs/:jobId', ({ params }) => {
    const job = findJob(String(params.jobId));
    if (!job) return notFound(`/api/v1/jobs/${String(params.jobId)}`);

    const snapshot = jobSnapshot(job);

    if (snapshot.status === 'completed') {
      // No `phase`, no `label`: a bar reading 70% next to the word
      // "completed" is worse than no bar at all (`B-038`).
      //
      // A completed **import** answers with its own outcome now (`B-067`) —
      // the profile it wrote, three counts, the language it read and the
      // warnings with their places. This is what a reload after extraction
      // gets, and the review screen is built on it rather than on the memory
      // of the tab that watched the stream.
      return HttpResponse.json<JobStatusBody>({
        jobId: job.jobId,
        status: 'completed',
        pct: 100,
        ...(job.kind === 'generation'
          ? { generationId: job.generationId, pageCount: 1 }
          : job.imported),
      });
    }

    if (snapshot.status === 'failed') {
      return HttpResponse.json<JobStatusBody>({
        jobId: job.jobId,
        status: 'failed',
        pct: snapshot.pct,
        error: failure(job),
      });
    }

    // Spread rather than listed: `phase` and `label` are absent while the
    // job is queued, and naming them here would put `undefined` back into a
    // body the server sends without them (`B-040`).
    return HttpResponse.json<JobStatusBody>({
      jobId: job.jobId,
      status: snapshot.status,
      ...frame(snapshot),
    });
  }),

  http.get('*/api/v1/jobs/:jobId/stream', ({ params }) => {
    const job = findJob(String(params.jobId));
    if (!job) return notFound(`/api/v1/jobs/${String(params.jobId)}/stream`);

    const encoder = new TextEncoder();
    const openedAt = Date.now();
    let id = 0;
    // Everything scheduled before the subscribe is already accounted for by
    // the snapshot. Starting this at 0 would replay the phases a late
    // subscriber missed, which is exactly what § 30.6 says not to do.
    let sent = openedAt;
    let sentSnapshot = false;

    const stream = new ReadableStream({
      async pull(controller) {
        // The snapshot, sent the instant the client connects. Two things
        // depend on it: a reconnecting client catches up without replay, and
        // a job that finished between the 202 and the subscribe still sends
        // its outcome (§ 30.6) — the worst failure this subsystem has.
        if (!sentSnapshot) {
          sentSnapshot = true;
          const snapshot = jobSnapshot(job, openedAt);

          if (!snapshot.terminal) {
            id += 1;
            controller.enqueue(encoder.encode(sseFrame('phase', frame(snapshot), id)));
            return;
          }
        }

        const next = phasesAfter(job, sent)[0];

        if (next) {
          await until(job.startedAt + next.at);
          sent = job.startedAt + next.at;
          id += 1;
          controller.enqueue(encoder.encode(sseFrame('phase', frame(next), id)));
          return;
        }

        await until(job.startedAt + TERMINAL_AT);
        id += 1;

        if (job.outcome === 'completed') {
          const payload: CompletedEvent | NonNullable<MockJob['imported']> =
            job.kind === 'import'
              ? job.imported!
              : {
                  generationId: job.generationId,
                  pageCount: 1,
                  matchLevel: job.fitReport?.level ?? 'STRONG',
                };

          controller.enqueue(encoder.encode(sseFrame('completed', payload, id)));
        } else {
          // The quota is given back on every failed job (`B-039`) — the one
          // this job actually spent, which is not always the same counter.
          const spent = metricFor(job);
          generations.usage[spent] = Math.max(0, generations.usage[spent] - 1);
          controller.enqueue(encoder.encode(sseFrame('failed', failure(job), id)));
        }

        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),

  /**
   * One generation, and how well it fits the posting.
   *
   * The endpoint the result screen could not be written without (`B-041`).
   * `fitReport` is absent in general mode rather than zeroed — there was no
   * posting to be relevant to, and a row of zeroes reads as a bad match.
   */
  /**
   * The history (`B-066`), newest first.
   *
   * Three behaviours worth having, and the first is the reason it is a cursor
   * at all: the list **grows from the top**, so an offset page taken after a
   * new generation landed would repeat one row and hide another. The cursor
   * carries the whole sort key — the instant *and* the id — because rows that
   * share a timestamp are ordered by id, and a cursor holding only the time
   * either skips the rest of that group or serves it twice.
   *
   * `total` is the account's count rather than the page's, which is what the
   * deletion screen reads. `limit` is **clamped, not refused**: a caller
   * asking for a thousand rows gets a hundred, because there is nothing wrong
   * with the request.
   */
  http.get('*/api/v1/generations', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 100);
    const cursor = url.searchParams.get('cursor');

    // Newest first, and only the generations: an import job has no row here.
    const rows = generations.jobs
      .filter((job) => job.kind === 'generation')
      .sort((a, b) => b.startedAt - a.startedAt || b.generationId.localeCompare(a.generationId));

    let start = 0;

    if (cursor) {
      const at = rows.findIndex((job) => historyCursor(job) === cursor);
      if (at < 0) {
        return HttpResponse.json(
          problem(400, 'VALIDATION_FAILED', GENERATIONS, [], { fields: ['cursor'] }),
          { status: 400 },
        );
      }
      start = at + 1;
    }

    const page = rows.slice(start, start + limit);
    const last = page[page.length - 1];
    const more = start + limit < rows.length;

    return HttpResponse.json<Schemas['GenerationPage']>({
      items: page.map((job) => ({
        generationId: job.generationId,
        status: job.outcome === 'completed' ? 'completed' : 'failed',
        createdAt: new Date(job.startedAt).toISOString(),
        ...(job.outcome === 'completed' ? { pageCount: 1 } : {}),
        ...(job.roleTitle ? { roleTitle: job.roleTitle } : {}),
        ...(job.companyName ? { companyName: job.companyName } : {}),
        ...(job.fitReport?.level ? { matchLevel: job.fitReport.level } : {}),
        ...(job.contentLanguage ? { contentLanguage: job.contentLanguage } : {}),
        hasCoverLetter: Boolean(generations.coverLetters[job.generationId]),
      })),
      // Absent at the end of the history. An empty `items` on the next call
      // would be one page too late to say so.
      ...(more && last ? { nextCursor: historyCursor(last) } : {}),
      total: rows.length,
    });
  }),

  http.get('*/api/v1/generations/:generationId', ({ params }) => {
    const id = String(params.generationId);
    const job = generations.jobs.find((candidate) => candidate.generationId === id);

    if (!job) return notFound(`/api/v1/generations/${id}`);

    return HttpResponse.json<Schemas['GenerationResponse']>({
      generationId: job.generationId,
      status: job.outcome === 'completed' ? 'completed' : 'failed',
      pageCount: 1,
      createdAt: new Date(job.startedAt).toISOString(),
      ...(job.fitReport ? { fitReport: job.fitReport } : {}),
      // `B-042`. Omitted rather than blank, the way `F-010` settled it.
      ...(job.contentLanguage ? { contentLanguage: job.contentLanguage } : {}),
      ...(job.postingLanguage ? { postingLanguage: job.postingLanguage } : {}),
      // Absent when none was written, which is a state the reader can act on
      // rather than an error: a letter that could not be written does not
      // fail the generation (`B-056`).
      ...(generations.coverLetters[id] ? { coverLetter: generations.coverLetters[id].text } : {}),
      // Absent until somebody judges it (`B-065`). This is the half that
      // makes `accessedAt` readable the day after the permission was given.
      ...(feedbackBody(id) ? { feedback: feedbackBody(id) } : {}),
    });
  }),

  /**
   * One verdict per generation (§ 48.4, `B-058`).
   *
   * Three behaviours, and none of them is a payload: the other thumb
   * **overwrites** rather than opening a second row, `contentGranted: false`
   * **revokes**, and a second yes does not push the window along — the
   * forty-eight hours run from the first one.
   *
   * `accessedAt` stays `null`, because nobody has looked. That is the field
   * the screen's sentence is built from, and a mock that filled it in would
   * hide the only state it usually has.
   */
  http.post('*/api/v1/generations/:generationId/feedback', async ({ params, request }) => {
    const id = String(params.generationId);
    const instance = `/api/v1/generations/${id}/feedback`;

    if (!generations.jobs.some((job) => job.generationId === id)) return notFound(instance);

    const body = (await request.json()) as {
      rating?: unknown;
      category?: string;
      contentGranted?: boolean;
    };

    // 1 or -1, and nothing else. The generated request type says `"1" | "-1"`
    // — a string — which is why this checks the number the endpoint documents
    // rather than trusting either.
    if (body.rating !== 1 && body.rating !== -1) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['rating'] }),
        { status: 400 },
      );
    }

    const existing = generations.feedback[id];
    const granted = body.contentGranted === true;

    const record = {
      rating: body.rating,
      ...(body.category ? { category: body.category } : {}),
      // Kept from the first yes. A second one does not move the window, and
      // `false` closes it outright.
      ...(granted ? { grantedAt: existing?.grantedAt ?? Date.now() } : {}),
    };

    generations.feedback[id] = record;

    return HttpResponse.json<Schemas['FeedbackResponse']>(feedbackBody(id)!);
  }),

  /**
   * A letter for a generation that already exists (§ 34, `B-056`).
   *
   * Three behaviours worth having, and none of them is a payload: the letter
   * **replaces** the stored one rather than adding to a list, the hourly
   * allowance is its own limit and not the daily quota, and the endpoint can
   * refuse a draft it wrote itself.
   */
  http.post(
    '*/api/v1/generations/:generationId/cover-letter/regenerate',
    async ({ params, request }) => {
      const id = String(params.generationId);
      const instance = `/api/v1/generations/${id}/cover-letter/regenerate`;
      const job = generations.jobs.find((candidate) => candidate.generationId === id);

      if (!job) return notFound(instance);

      if (generations.coverLetterAttempts >= COVER_LETTER_LIMIT) {
        const at = inAnHour();

        return HttpResponse.json(problem(429, 'RATE_LIMITED', instance, [], { resetsAt: at }), {
          status: 429,
          /*
            The header was there all along (`B-062`). `ProblemDetailAdvice`
            derives it from **any** 429 whose `params.resetsAt` is an instant,
            and this endpoint goes through the same advice — what was missing
            was an `@ApiResponse` publishing it and a test saying it had been
            seen on the wire, and the absence of those two is
            indistinguishable from the absence of the header. This mock read
            it as absent and was wrong, which is a thing a mock can be.
          */
          headers: { 'Retry-After': String(Math.ceil((Date.parse(at) - Date.now()) / 1000)) },
        });
      }

      generations.coverLetterAttempts += 1;

      // The body is entirely optional: `{}` is a valid request, and the server
      // defaults the style.
      const body = ((await request.json().catch(() => ({}))) ?? {}) as Partial<CoverLetterRequest>;
      const style = body.style ?? 'default';

      if (claimCoverLetterRejection()) {
        return HttpResponse.json(
          problem(422, 'COVER_LETTER_REJECTED', instance, [{ action: 'retry' }], {
            issues: ['unsupported_claim'],
          }),
          { status: 422 },
        );
      }

      generations.coverLetters[id] = { text: coverLetterText(style), style };

      return HttpResponse.json<Schemas['CoverLetterResponse']>({
        generationId: id,
        coverLetter: generations.coverLetters[id].text,
        style,
      });
    },
  ),

  http.get('*/api/v1/generations/:generationId/download', ({ params, request }) => {
    const id = String(params.generationId);
    const instance = `/api/v1/generations/${id}/download`;

    // Content negotiation, because the real server does it and refusing here
    // is the only way a client learns before production. Asking this endpoint
    // for JSON — which the API client did, by default — is a **406**, and it
    // was measured against the running backend rather than guessed at.
    const accept = request.headers.get('Accept') ?? '*/*';

    if (!accept.includes('application/pdf') && !accept.includes('*/*')) {
      return HttpResponse.json(problem(406, 'NOT_ACCEPTABLE', instance), { status: 406 });
    }

    if (generations.expired.includes(id)) {
      return HttpResponse.json(problem(410, 'GENERATION_ARTIFACT_EXPIRED', instance), {
        status: 410,
      });
    }

    if (!generations.jobs.some((job) => job.generationId === id)) return notFound(instance);

    return new HttpResponse(onePagePdf(), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="atomcv-cv-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  }),

  /**
   * A bare array, as the server sends it — not an object with a `metrics`
   * key. Both metrics are always there: a missing entry would mean "no such
   * metric", never "zero used".
   */
  http.get('*/api/v1/account/usage', () =>
    HttpResponse.json<Schemas['Usage'][]>([
      // The same `currentQuota()` the capability set reads. An account has a
      // different pair, and a usage screen disagreeing with `capabilities`
      // was the failure this single source exists to prevent (§ 35.7).
      metric('generation', generations.usage.generation, currentQuota().generation),
      metric('profile_extract', generations.usage.profile_extract, currentQuota().profile_extract),
    ]),
  ),
];

/**
 * One metric's allowance.
 *
 * The counter records **attempts**, because a refused request takes a unit
 * too — otherwise a user past their limit could hammer the endpoint for free.
 * `used` is that number capped at the limit, so `used`/`limit` is a pair that
 * prints as it is, and `attempted` keeps the truth beside it (`B-040`).
 */
function metric(name: string, attempted: number, limit: number): Schemas['Usage'] {
  const used = Math.min(attempted, limit);

  return { metric: name, used, attempted, limit, remaining: limit - used, resetsAt: resetsAt() };
}

/** The `202` every job-queueing endpoint answers with (§ 35.3). */
export function accepted(job: MockJob) {
  return HttpResponse.json<Schemas['AcceptedJobResponse']>(
    { jobId: job.jobId, status: 'queued', streamUrl: `/api/v1/jobs/${job.jobId}/stream` },
    { status: 202, headers: { Location: `/api/v1/jobs/${job.jobId}` } },
  );
}

function findJob(jobId: string) {
  return generations.jobs.find((job) => job.jobId === jobId);
}

function notFound(instance: string) {
  return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
}

/**
 * The SSE `phase` payload: the progress fields, and none of the job's
 * identity. Empty ones are dropped rather than sent as `""` (`B-040`), which
 * is what makes `label` safe to treat as a translation key.
 */
function frame(step: PhaseEvent): PhaseEvent {
  return {
    ...(step.phase ? { phase: step.phase } : {}),
    ...(step.label ? { label: step.label } : {}),
    pct: step.pct,
    ...(step.detail ? { detail: step.detail } : {}),
  };
}

/**
 * The `failed` payload, in the envelope's own vocabulary. It is the same
 * error a 4xx body would carry, which is what lets one renderer handle both
 * transports instead of two parallel `switch (code)` blocks.
 */
function failure(job: MockJob): FailedEvent {
  // What a test asked for, when it asked. The default stands in for the
  // failure that has nothing to do with the request — a compiler that fell
  // over — while `gateRefusal` covers § 18.4, which very much does (`B-043`).
  return (
    job.failure ?? {
      code: 'COMPILATION_FAILED',
      params: { detail: 'Undefined control sequence.', rawSourceAvailable: true },
      resolutions: [{ action: 'retry' }],
    }
  );
}

function until(at: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, at - Date.now())));
}
