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
import type { components } from '@/types/api';
import type { CompletedEvent, FailedEvent, PhaseEvent } from './contracts';
import { problem } from './problem';
import { fixture } from './profileFixture';
import {
  generations,
  jobSnapshot,
  phasesAfter,
  QUOTA,
  TERMINAL_AT,
  type MockJob,
} from './generationFixture';

type Schemas = components['schemas'];
type GenerationRequest = Schemas['GenerationRequest'];

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
 */
function readsAsAPosting(text: string): boolean {
  if (text.length > 20_000) return false;

  // `toLowerCase` with no locale: this is a wire vocabulary, not user text,
  // and the Turkish locale folds `I` to a dotless `ı` — after which
  // `qualifications` never matches again (rule 11).
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  if (words.length < 40) return false;
  if (new Set(words).size / words.length < 0.15) return false;

  return new Set(words.filter((word) => SIGNAL_WORDS.includes(word))).size >= 2;
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

/** The next UTC midnight, which is 03:00 in Turkey (`F-007`). */
function resetsAt(): string {
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

    if (generations.usage.generation >= QUOTA.generation) {
      const at = resetsAt();

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

    if (jobDescription !== '' && !body.acknowledgePreflight && !readsAsAPosting(jobDescription)) {
      return HttpResponse.json(
        problem(
          422,
          'UNPARSEABLE_JOB_DESCRIPTION',
          GENERATIONS,
          // The spec's order: insist, fix the text, or drop the posting.
          [
            { action: 'continue_anyway' },
            { action: 'paste_full_posting' },
            { action: 'continue_as_general_cv' },
          ],
          // Both zero. The preflight analysed nothing, and zero says so
          // honestly; real numbers arrive only from the plausibility gate.
          { confidence: 0, skillsFound: 0 },
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
      generationId: `gen-${generations.jobs.length + 1}`,
      startedAt: Date.now(),
      outcome: generations.nextOutcome,
      ...(key ? { idempotencyKey: key } : {}),
    };

    generations.jobs.push(job);
    generations.nextOutcome = 'completed';
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
      return HttpResponse.json<Schemas['JobStatusResponse']>({
        jobId: job.jobId,
        status: 'completed',
        pct: 100,
        generationId: job.generationId,
      });
    }

    if (snapshot.status === 'failed') {
      return HttpResponse.json<Schemas['JobStatusResponse']>({
        jobId: job.jobId,
        status: 'failed',
        pct: snapshot.pct,
        error: failure(),
      });
    }

    return HttpResponse.json<Schemas['JobStatusResponse']>({
      jobId: job.jobId,
      status: snapshot.status,
      phase: snapshot.phase,
      label: snapshot.label,
      pct: snapshot.pct,
      detail: snapshot.detail,
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
          controller.enqueue(
            encoder.encode(
              sseFrame(
                'completed',
                { generationId: job.generationId, pageCount: 1 } satisfies CompletedEvent,
                id,
              ),
            ),
          );
        } else {
          // The quota is given back on every failed job (`B-039`).
          generations.usage.generation = Math.max(0, generations.usage.generation - 1);
          controller.enqueue(encoder.encode(sseFrame('failed', failure(), id)));
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
      {
        metric: 'generation',
        used: generations.usage.generation,
        limit: QUOTA.generation,
        resetsAt: resetsAt(),
      },
      {
        metric: 'profile_extract',
        used: generations.usage.profile_extract,
        limit: QUOTA.profile_extract,
        resetsAt: resetsAt(),
      },
    ]),
  ),
];

function accepted(job: MockJob) {
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

/** The SSE `phase` payload: four fields, and none of the job's identity. */
function frame(step: PhaseEvent): PhaseEvent {
  return { phase: step.phase, label: step.label, pct: step.pct, detail: step.detail };
}

/**
 * The `failed` payload, in the envelope's own vocabulary. It is the same
 * error a 4xx body would carry, which is what lets one renderer handle both
 * transports instead of two parallel `switch (code)` blocks.
 */
function failure(): FailedEvent {
  return {
    code: 'COMPILATION_FAILED',
    params: { detail: 'Undefined control sequence.', rawSourceAvailable: true },
    resolutions: [{ action: 'retry' }],
  };
}

function until(at: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, at - Date.now())));
}
