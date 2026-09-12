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
import { INSTRUCTION_MAX_LENGTH } from '@/lib/api/endpoints/generations';
import type { JobStatus } from '@/lib/api/endpoints/jobs';
import type { components } from '@/types/api';
import type { CompletedEvent, FailedEvent, PhaseEvent } from './contracts';
import { problem } from './problem';
import { fixture } from './profileFixture';
import {
  claimCoverLetterRejection,
  findGeneration,
  isGenerationJob,
  COVER_LETTER_LIMIT,
  coverLetterText,
  FIT_REPORT,
  generations,
  jobSnapshot,
  metricFor,
  phasesAfter,
  TERMINAL_AT,
  type MockGenerationJob,
  type MockSelectionLine,
  type MockImportOutcome,
  type MockJob,
} from './generationFixture';
import { challengeRefused } from './authFixture';
import { currentQuota, isAccount } from './sessionFixture';

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

/** Word's own, and long enough that nothing should be retyping it. */
export const DOCX_MEDIA_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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

/** The only employer this mock can name. */
const MOCK_COMPANY = 'Acme';

/**
 * Whether the posting carries the employer's name (§ 18.4.1, `F-025`).
 *
 * Unlike the language guess above this is **not** a stand-in for Faz A: the
 * server's rule is itself a containment check, insensitive to case and line
 * breaks, and dropping `company.name` when the posting does not contain it is
 * exactly what stopped `"not specified"` from reaching a history row.
 *
 * `toLocaleLowerCase('en')` rather than the reader's locale (absolute rule
 * 11): a posting is user text, and Turkish folds `I` to `ı`.
 */
function namesTheEmployer(text: string): boolean {
  return text.toLocaleLowerCase('en').includes(MOCK_COMPANY.toLocaleLowerCase('en'));
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
 * A minimal but genuinely valid `.docx`, for the same reason the PDF above is
 * genuinely a PDF: the dev harness saves the file and something opens it, and
 * a Word document Word refuses looks like a bug in the client.
 *
 * A `.docx` is an OPC zip of three parts. The entries are **stored**, not
 * deflated — no compressor is needed and the reader does not care — so all
 * this has to get right is the CRC and the offsets.
 */
function onePageDocx(): Uint8Array {
  const files = [
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Target="word/document.xml" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"/>' +
        '</Relationships>',
    ],
    [
      'word/document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:body><w:p><w:r><w:t>AtomCV</w:t></w:r></w:p></w:body></w:document>',
    ],
  ] as const;

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const [name, xml] of files) {
    const nameBytes = encoder.encode(name);
    const content = encoder.encode(xml);
    const crc = crc32(content);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    const entry = new Uint8Array(46 + nameBytes.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint16(4, 20, true);
    entryView.setUint16(6, 20, true);
    entryView.setUint32(16, crc, true);
    entryView.setUint32(20, content.length, true);
    entryView.setUint32(24, content.length, true);
    entryView.setUint16(28, nameBytes.length, true);
    entryView.setUint32(42, offset, true);
    entry.set(nameBytes, 46);

    parts.push(local, content);
    directory.push(entry);
    offset += local.length + content.length;
  }

  const directorySize = directory.reduce((total, entry) => total + entry.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, offset, true);

  const zip = new Uint8Array(offset + directorySize + end.length);
  let at = 0;
  for (const chunk of [...parts, ...directory, end]) {
    zip.set(chunk, at);
    at += chunk.length;
  }

  return zip;
}

/** The one zip field a reader actually verifies. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A row's place in the history, as an opaque string.
 *
 * The **whole** sort key, not just the instant: two generations made in the
 * same millisecond are ordered by id, and a cursor carrying only the time
 * would either skip the rest of that group or hand it out twice. Base64 so
 * nothing is tempted to read it — the client's job is to echo it back.
 */
function historyCursor(job: MockGenerationJob): string {
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
  /*
    Null for an anonymous caller (`B-082`), whoever wrote it. The verdict and
    the 48-hour diagnostic grant both belong to an account: somebody has to be
    reachable when the grant is read, and an anonymous session is gone two
    hours after its last activity.
  */
  if (!isAccount()) return undefined;

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

    /*
      § 35.7.4's challenge (`B-083`), and it comes before everything that
      costs something: the counters of § 44.1 say *how much*, never *who*, and
      this is the only question in the request about whether there is a person
      behind it.

      **Anonymous only.** An account answered a challenge to sign in
      (§ 40.4.1), and a token it sends anyway is ignored rather than checked —
      asking the same person twice is friction with nothing behind it.

      Off unless a test asks for production, exactly as the magic link's is:
      a deployment without a Turnstile secret lets the request through, and
      that is why "it worked locally" is not evidence this field is being
      sent.
    */
    if (!isAccount() && challengeRefused(body.challengeToken)) {
      return HttpResponse.json(problem(403, 'CHALLENGE_FAILED', GENERATIONS), { status: 403 });
    }

    /*
      § 35.7.3: a letter is an account's (`B-082`). Refused **before the quota
      gate below**, deliberately — the request is turned away without spending
      a generation, so the reader loses a round trip rather than one of their
      five. `params.feature` names the box that has to close.
    */
    if (!isAccount() && body.coverLetter) {
      return HttpResponse.json(
        problem(403, 'FEATURE_REQUIRES_ACCOUNT', GENERATIONS, [{ action: 'sign_up' }], {
          feature: 'cover_letter',
        }),
        { status: 403 },
      );
    }

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
      // Frozen here rather than read back off the profile later (`B-097`):
      // what this CV printed is what the toggle screen has to show, and the
      // atom behind a line can be reworded the minute after.
      selection: weigh(),
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
        `B-070`'s two labels. The role is a stand-in in the same sense the
        language guess above is one — reading a title out of a posting is Faz
        A's work — so what is real here is the **shape**: present when there
        was a posting, absent rather than empty otherwise. The server does not
        apply § 18.4.1 to it, because a model rewrites a title legitimately
        ("Senior Backend Engineer" ↔ "Backend Engineer (Senior)").

        The employer is different, and `F-025` is why: it is a name the
        posting carries or it is nothing. So this mock can produce the row the
        wire produces most often — a role with no company — which it could
        not while both were written together.
      */
      ...(jobDescription === '' ? {} : { roleTitle: 'Senior Backend Engineer' }),
      ...(namesTheEmployer(jobDescription) ? { companyName: MOCK_COMPANY } : {}),
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
        ...(job.kind === 'generation' ? completedOutcome(job) : job.imported),
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
          const payload: CompletedEvent | MockImportOutcome =
            job.kind === 'import' ? job.imported : completedOutcome(job);

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
    /*
      Neither the imports nor the retired rows (`B-088`). Twenty edits are
      twenty-one generations and **one CV**, so a history that listed them
      would read as twenty-one resumes — and `total`, which the deletion
      screen states out loud, would say the same.
    */
    const rows = generations.jobs
      .filter(isGenerationJob)
      .filter((job) => !job.supersededBy)
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
    const job = findGeneration(id);

    if (!job) return notFound(`/api/v1/generations/${id}`);

    return HttpResponse.json<Schemas['GenerationResponse']>({
      generationId: job.generationId,
      // Still readable and still downloadable once it has been edited, and
      // that is the point of keeping it (`B-088`) — what changes is that it
      // is no longer the one to edit.
      status: job.supersededBy
        ? 'superseded'
        : job.outcome === 'completed'
          ? 'completed'
          : 'failed',
      // Only on a retired row, which is the only place it means anything
      // (`B-097`). The edge runs the other way in the database — the edit
      // writes the new row naming the old — and this is the direction a
      // screen needs: the reader is looking at the one that was replaced.
      ...(job.supersededBy ? { supersededByGenerationId: job.supersededBy } : {}),
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
   * What this generation weighed (§ 24.4, `B-097`).
   *
   * The list the toggle screen is drawn from, and the whole of the endpoint:
   * **every id here is one the edit endpoint accepts**, which is what makes
   * a button on it pressable. On-page lines first, then the ones the budget
   * held back in the order they competed.
   *
   * No score travels with a line. § 23.3's objection to a percentage holds
   * for a number beside a bullet too, and the order already says what the
   * ranking was.
   *
   * A retired generation still answers: the screen that shows one is the
   * screen that explains why its toggles are gone.
   */
  http.get('*/api/v1/generations/:generationId/selection', ({ params }) => {
    const id = String(params.generationId);
    const job = findGeneration(id);

    if (!job) return notFound(`${GENERATIONS}/${id}/selection`);

    return HttpResponse.json<Schemas['SelectionViewResponse']>({
      generationId: job.generationId,
      lines: job.selection,
    });
  }),

  /**
   * Faz G's hand toggle (§ 24.4, `B-088`).
   *
   * Four behaviours, and only the first is a payload:
   *
   * - **it costs nothing** — no model call, nothing off the allowance, which
   *   is the difference from the sentence endpoint next door;
   * - an atom this generation never weighed is a **400**, not a no-op: a
   *   silent 202 would hand back the same document and look like a bug;
   * - editing an already-edited generation is **409**, because the row it
   *   would be based on is not the newest one;
   * - the job it starts makes a **new** generation and retires this one.
   */
  http.post('*/api/v1/generations/:generationId/selection', async ({ params, request }) => {
    const id = String(params.generationId);
    const instance = `${GENERATIONS}/${id}/selection`;
    const source = findGeneration(id);

    if (!source) return notFound(instance);
    if (source.supersededBy) return supersededRefusal(instance);

    const body = ((await request.json()) ?? {}) as { include?: string[]; exclude?: string[] };
    const include = body.include ?? [];
    const exclude = body.exclude ?? [];

    if (include.length === 0 && exclude.length === 0) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['include', 'exclude'] }),
        { status: 400 },
      );
    }

    // The three refusals the endpoint names, and `params.fields` carries the
    // offending ids rather than the field names: the server says which atom
    // was wrong, which is the only thing a screen could act on.
    //
    // "Unknown" is measured against **this generation's** lines, not against
    // the profile (`B-097`). An atom that exists but was never weighed here
    // is exactly the 400 the endpoint is documented to answer, and a mock
    // that accepted it would hide the reason the read endpoint had to exist.
    const both = include.filter((atomId) => exclude.includes(atomId));
    const unknown = [...include, ...exclude].filter(
      (atomId) => !source.selection.some((line) => line.atomId === atomId),
    );

    if (both.length > 0 || unknown.length > 0) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], {
          fields: [...new Set([...both, ...unknown])],
        }),
        { status: 400 },
      );
    }

    return accepted(supersede(source, { include, exclude }));
  }),

  /**
   * The same edit, in a sentence (§ 24.2, `B-089`).
   *
   * **This one is charged**, and the refund is real: a sentence the model
   * could not match answers `422 EDIT_NOT_UNDERSTOOD` and gives the unit
   * back. The refusal is deliberately easy to reach here — it is the common
   * answer, not an edge case, and a screen written against a mock that always
   * succeeded would have no message for it.
   */
  http.post('*/api/v1/generations/:generationId/edits', async ({ params, request }) => {
    const id = String(params.generationId);
    const instance = `${GENERATIONS}/${id}/edits`;
    const source = findGeneration(id);

    if (!source) return notFound(instance);
    if (source.supersededBy) return supersededRefusal(instance);

    const body = ((await request.json()) ?? {}) as { instruction?: string };
    const instruction = (body.instruction ?? '').trim();

    if (instruction === '' || instruction.length > INSTRUCTION_MAX_LENGTH) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['instruction'] }),
        { status: 400 },
      );
    }

    if (generations.usage.generation >= currentQuota().generation) {
      const at = resetsAt();

      // Charged even when refused, the way the generation gate charges: a
      // refused request takes a unit too, or somebody past their limit could
      // hammer the endpoint for free (`B-040`).
      generations.usage.generation += 1;

      return HttpResponse.json(
        problem(429, 'QUOTA_EXCEEDED', instance, [], { metric: 'generation', resetsAt: at }),
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((Date.parse(at) - Date.now()) / 1000)) },
        },
      );
    }

    // Charged on enqueue, like a generation.
    generations.usage.generation += 1;

    /*
      § 24.2's refusal. The model is shown the lines numbered and answers with
      numbers, so it cannot name a bullet that does not exist — what it can do
      is match nothing, and then the server does nothing rather than remove
      the wrong line.

      The trigger is the **shape of the request**, not a magic string a real
      server would ignore: a sentence naming no atom of this profile is one
      nothing could be matched to. That is as close as a mock can honestly get
      to a model's judgement, and it makes the common answer reachable.
    */
    if (!namesAnAtom(instruction)) {
      // Refunded, which is why the counter goes back before the answer.
      generations.usage.generation = Math.max(0, generations.usage.generation - 1);

      return HttpResponse.json(
        problem(422, 'EDIT_NOT_UNDERSTOOD', instance, [{ action: 'retry' }]),
        { status: 422 },
      );
    }

    // No toggle moves here, and that is honest rather than lazy: the server
    // resolves the model's line numbers into the same include/exclude the
    // hand toggle sends (§ 24.2), and this mock has no model to get numbers
    // from. What it does encode is the part a screen can see — the edited
    // generation is retired and a new one takes its place.
    return accepted(supersede(source));
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

    if (!findGeneration(id)) return notFound(instance);

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

    /*
      An anonymous caller has no verdict to give (`B-082`): the read answers
      `feedback: null` for one, so a write that succeeded would contradict the
      read a moment later.

      **The shape was a guess and is now the contract** (`B-087`): the server
      answered `401` here until `F-031` asked what it should be, which told an
      anonymous caller holding a live session that the session had ended. The
      code, the `params.feature` and the `sign_up` below are what it sends
      today, and `feature` is one of the four `AccountFeature` publishes.
    */
    if (!isAccount()) {
      return HttpResponse.json(
        problem(403, 'FEATURE_REQUIRES_ACCOUNT', instance, [{ action: 'sign_up' }], {
          feature: 'feedback',
        }),
        { status: 403 },
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
      const job = findGeneration(id);

      if (!job) return notFound(instance);

      /*
        The same refusal `POST /generations` gives the box (§ 35.7.3,
        `B-082`), on the endpoint behind the button: a letter cannot be asked
        for after the fact either. Ahead of the hourly limiter for the reason
        the generation gate is ahead of the quota — a request that will never
        be served should not spend an allowance.
      */
      if (!isAccount()) {
        return HttpResponse.json(
          problem(403, 'FEATURE_REQUIRES_ACCOUNT', instance, [{ action: 'sign_up' }], {
            feature: 'cover_letter',
          }),
          { status: 403 },
        );
      }

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
            // The pair the real guard actually sent, measured on 2026-08-30
            // against `make record`. It used to be one issue, invented: a
            // single-element list never exercises `Intl.ListFormat`, and the
            // wire sends two or three.
            issues: ['number_invented', 'length_out_of_range'],
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

    // Absent means PDF, the way the server defaults it (`B-094`).
    const format = new URL(request.url).searchParams.get('format') ?? 'pdf';

    // Content negotiation, because the real server does it and refusing here
    // is the only way a client learns before production. Asking this endpoint
    // for JSON — which the API client did, by default — is a **406**, and it
    // was measured against the running backend rather than guessed at.
    const accept = request.headers.get('Accept') ?? '*/*';
    const produced = format === 'docx' ? DOCX_MEDIA_TYPE : 'application/pdf';

    if (!accept.includes(produced) && !accept.includes('*/*')) {
      return HttpResponse.json(problem(406, 'NOT_ACCEPTABLE', instance), { status: 406 });
    }

    /*
      § 35.3's map has a third value and nothing serves it, so `format=source`
      is a `400` rather than a quiet PDF (`B-094`). Encoded here because it is
      the refusal a client is most likely to write against by accident: a
      silent fallback would make a "download the source" button produce a PDF,
      and nobody would notice until somebody opened it.
    */
    if (format !== 'pdf' && format !== 'docx') {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['format'] }),
        { status: 400 },
      );
    }

    if (generations.expired.includes(id)) {
      return HttpResponse.json(problem(410, 'GENERATION_ARTIFACT_EXPIRED', instance), {
        status: 410,
      });
    }

    if (!findGeneration(id)) return notFound(instance);

    const day = new Date().toISOString().slice(0, 10);

    return new HttpResponse(format === 'docx' ? onePageDocx() : onePagePdf(), {
      headers: {
        'Content-Type': produced,
        'Content-Disposition': `attachment; filename="atomcv-cv-${day}.${format}"`,
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

/**
 * Retires a generation and queues the one that replaces it (`B-088`).
 *
 * The new job inherits everything the edited one was read against — the fit
 * report, both language tags, the labels the history row is drawn from —
 * because an edit changes **which atoms are on the page**, not what the
 * posting said. Re-deriving any of it would make the mock disagree with
 * itself two edits in.
 */
function supersede(
  source: MockGenerationJob,
  change: { include: string[]; exclude: string[] } = { include: [], exclude: [] },
): MockGenerationJob {
  const replacement: MockGenerationJob = {
    ...source,
    // The edit applies to the **selection state**, never to the document, so
    // the new generation is the old selection with the toggles moved
    // (§ 24.4). Re-weighing here would make the page limit a fresh promise
    // instead of the one that was already kept.
    selection: source.selection.map((line) => ({
      ...line,
      onPage: change.include.includes(line.atomId)
        ? true
        : change.exclude.includes(line.atomId)
          ? false
          : line.onPage,
    })),
    jobId: crypto.randomUUID(),
    generationId: crypto.randomUUID(),
    startedAt: Date.now(),
    outcome: 'completed',
    // The replacement is the newest row; nothing has replaced it yet.
    supersededBy: undefined,
    // A new job, so the key that made the old one must not travel with it:
    // a repeat of the original request would otherwise find this one.
    idempotencyKey: undefined,
    // The stream names the generation that **was** edited, so the job needs
    // to know which one that is.
    supersededGenerationId: source.generationId,
  };

  source.supersededBy = replacement.generationId;
  generations.jobs.push(replacement);

  // The letter travels with the CV: the edit changed which bullets are on the
  // page, and the letter was written from the atoms rather than from the
  // document. Leaving it behind would look like the edit deleted it.
  const letter = generations.coverLetters[source.generationId];
  if (letter) generations.coverLetters[replacement.generationId] = letter;

  return replacement;
}

/** § 24's 409, and it carries no way out — the server offers none. */
function supersededRefusal(instance: string) {
  return HttpResponse.json(problem(409, 'GENERATION_SUPERSEDED', instance), { status: 409 });
}

/**
 * Whether a sentence names anything this profile actually has.
 *
 * A stand-in for the model, and the honest kind: it decides on the request
 * rather than on a magic value, so a screen cannot be written against a
 * trigger the real server ignores. Matching is on whole words of four
 * characters or more — "the" and "put" name nothing — and folds with an
 * explicit `en` locale, because absolute rule 11 is about exactly this
 * transform.
 */
function namesAnAtom(instruction: string): boolean {
  const words = instruction
    .toLocaleLowerCase('en')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4);

  return fixture.atoms.some((atom) =>
    (atom.variants ?? []).some((variant) => {
      const text = (variant.plainText ?? '').toLocaleLowerCase('en');
      return words.some((word) => text.includes(word));
    }),
  );
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
 * Which atoms a new generation weighs, and which of them reach the page.
 *
 * A stand-in for Faz B and Faz C the way `namesAnAtom` stands in for the
 * model: it decides on the profile rather than on a magic value, so the
 * screen cannot be written against an arrangement the server never produces.
 * Importance is the ranking, the ones at or above the middle fit, and the
 * rest are what the budget held back — so the fixture always has both states
 * and the order is the one they competed in.
 *
 * The text is the primary wording's, copied now. That is the snapshot the
 * endpoint promises: § 24.2 numbers the lines this CV printed.
 */
function weigh(): MockSelectionLine[] {
  return fixture.atoms
    .map((atom) => ({
      atomId: atom.id ?? '',
      text: (atom.variants ?? []).find((variant) => variant.primary)?.plainText ?? '',
      onPage: (atom.importance ?? 0) >= 0.5,
      importance: atom.importance ?? 0,
    }))
    .sort((a, b) => Number(b.onPage) - Number(a.onPage) || b.importance - a.importance)
    .map(({ atomId, text, onPage }) => ({ atomId, text, onPage }));
}

/**
 * What a finished generation job says, on **both** transports (`B-098`).
 *
 * The stream sends this as the terminal event and `GET /jobs/{id}` spreads
 * the same object into its body, because § 35.3 makes them the same thing: a
 * key the worker writes into `result` is a field on `JobStatusResponse`. Two
 * of these fields used to be on the stream alone — the schema published
 * neither, so the poll dropped them and a reconnect lost the answer (`F-032`).
 * Written once here so the mock cannot drift back into two payloads.
 *
 * `matchLevel` is absent in general mode, where there was no posting to be
 * relevant to, and `supersededGenerationId` on anything but a Faz G edit.
 */
function completedOutcome(job: MockGenerationJob): CompletedEvent {
  return {
    generationId: job.generationId,
    pageCount: 1,
    ...(job.fitReport?.level ? { matchLevel: job.fitReport.level } : {}),
    ...(job.supersededGenerationId ? { supersededGenerationId: job.supersededGenerationId } : {}),
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
