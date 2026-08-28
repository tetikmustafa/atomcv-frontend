import { describe, expect, it } from 'vitest';
import { api } from '@/lib/api/client';
import { ApiError, isApiError } from '@/lib/api/errors';
import {
  expireGeneration,
  failNextJob,
  generations,
  pauseGeneration,
  QUOTA,
} from '@/mocks/generationFixture';
import { fixture } from '@/mocks/profileFixture';
import type { components } from '@/types/api';

type AcceptedJob = components['schemas']['AcceptedJobResponse'];
type JobStatus = components['schemas']['JobStatusResponse'];
type Usage = components['schemas']['Usage'];
type GenerationResponse = components['schemas']['GenerationResponse'];

/** Reads as a posting: two distinct signal words and more than forty of them. */
const POSTING = [
  'We are seeking a senior backend engineer to join a small platform team.',
  'Responsibilities: designing services, operating them in production, and',
  'mentoring the engineers around you. Requirements: several years of Java,',
  'PostgreSQL, container orchestration and a habit of writing things down.',
  'Preferred qualifications include message queues and infrastructure as code.',
].join(' ');

/**
 * The mock generation surface, against the behaviours measured on the running
 * backend rather than against the documents.
 *
 * These are tests of a mock, which is only worth writing because the mock is
 * the contract three environments share (browser, Vitest, Playwright). A
 * drift here reaches development and the whole test suite at once, and the
 * screens built on top would be built against a server nobody runs.
 */

type Frame = { id: string; event: string; data: unknown };

/** Reads a whole SSE response into frames, in arrival order. */
async function readStream(streamUrl: string): Promise<Frame[]> {
  const response = await fetch(streamUrl, { headers: { Accept: 'text/event-stream' } });
  expect(response.headers.get('Content-Type')).toBe('text/event-stream');

  const text = await response.text();

  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const fields = Object.fromEntries(
        block.split('\n').map((line) => {
          const at = line.indexOf(':');
          return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
        }),
      );

      return { id: fields.id!, event: fields.event!, data: JSON.parse(fields.data!) };
    });
}

function start(body: Record<string, unknown> = { acknowledgePreflight: false }) {
  return api.post<AcceptedJob>('/generations', body);
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const caught: unknown = await promise.catch((error: unknown) => error);
  if (!isApiError(caught)) throw new Error('expected an ApiError');
  return caught;
}

describe('the progress stream', () => {
  it('opens with a snapshot and closes on exactly one terminal event', async () => {
    const job = await start();
    const frames = await readStream(job.streamUrl!);

    // The snapshot, sent on connect. It carries `pct` and nothing else:
    // `phase` and `label` are **omitted** while there is no phase to name
    // (`B-040`), rather than sent as empty strings — an empty translation key
    // is not a key, and the shape says so now instead of leaving the client
    // to know it.
    expect(frames[0]!.event).toBe('phase');
    expect(frames[0]!.data).toEqual({ pct: 0 });

    const terminal = frames.filter((frame) => frame.event !== 'phase');
    expect(terminal).toHaveLength(1);
    expect(terminal[0]!.event).toBe('completed');
    // Ordering, not a count at an instant: the terminal event is last, and a
    // stream that kept going after it would fail here.
    expect(frames[frames.length - 1]).toBe(terminal[0]);
  });

  it('sends the phase keys the server sends, never a sentence', async () => {
    const job = await start();
    const frames = await readStream(job.streamUrl!);

    const labels = frames
      .filter((frame) => frame.event === 'phase')
      .map((frame) => (frame.data as { label: string }).label)
      .filter(Boolean);

    expect(labels).toEqual([
      'generation.phase.ANALYSING',
      'generation.phase.MEASURING',
      'generation.phase.SCORING',
      // Faz D, and it is not in every generation (`B-055`): general-CV mode
      // never runs it, and a posting naming no skills skips it. The mock
      // always sends it, because the screen that has never met the phase is
      // the one that draws a blank caption at 60%.
      'generation.phase.REWRITING',
      'generation.phase.RENDERING',
    ]);
  });

  it('catches a late subscriber up with the current phase, not with a replay', async () => {
    const job = await start();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const frames = await readStream(job.streamUrl!);
    const labels = frames
      .filter((frame) => frame.event === 'phase')
      .map((frame) => (frame.data as { label: string }).label);

    // The state on connect, then only what happens afterwards. `Last-Event-ID`
    // is accepted and not replayed from (§ 30.6), so a client that missed the
    // first two phases never sees them — and must not need to.
    expect(labels).toEqual([
      'generation.phase.MEASURING',
      'generation.phase.SCORING',
      'generation.phase.REWRITING',
      'generation.phase.RENDERING',
    ]);
  });

  it('sends its outcome to a client that subscribes after the job finished', async () => {
    const job = await start();
    // The worst failure this subsystem has: a job that finished between the
    // 202 and the subscribe going silent, leaving a spinner over work that is
    // already done (§ 30.6).
    await new Promise((resolve) => setTimeout(resolve, 2200));

    const frames = await readStream(job.streamUrl!);

    expect(frames).toHaveLength(1);
    expect(frames[0]!.event).toBe('completed');
  });

  it('carries a failure in the envelope the synchronous errors use', async () => {
    failNextJob();
    const job = await start();

    const frames = await readStream(job.streamUrl!);
    const last = frames[frames.length - 1]!;

    expect(last.event).toBe('failed');
    // The same shape a 4xx body carries, which is what lets one renderer
    // handle both transports.
    expect(last.data).toMatchObject({
      code: 'COMPILATION_FAILED',
      resolutions: [{ action: 'retry' }],
    });
  });
});

describe('the job status endpoint', () => {
  it('reports 100 and no phase once a job is done', async () => {
    const job = await start();
    await readStream(job.streamUrl!);

    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);

    expect(status.status).toBe('completed');
    expect(status.pct).toBe(100);
    expect(status.generationId).toBeTruthy();
    // A bar reading 70% beside the word "completed" is worse than no bar.
    expect(status.phase).toBeUndefined();
    expect(status.label).toBeUndefined();
  });

  it('keeps where a failed job stopped', async () => {
    failNextJob();
    const job = await start();
    await readStream(job.streamUrl!);

    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);

    expect(status.status).toBe('failed');
    // Not 100. Where it stopped is the most useful thing known about it.
    expect(status.pct).toBe(70);
    expect(status.generationId).toBeUndefined();
  });

  it('answers 404 for a job that is not yours', async () => {
    const error = await rejection(api.get('/jobs/someone-elses-job'));

    expect(error.status).toBe(404);
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('the gates in front of the queue', () => {
  it('refuses an empty profile before queueing anything', async () => {
    fixture.atoms.length = 0;

    const error = await rejection(start());

    expect(error.status).toBe(422);
    expect(error.code).toBe('INSUFFICIENT_PROFILE');
    expect(error.resolutions.map((resolution) => resolution.action)).toEqual(['complete_profile']);
    // Refused means refused: nothing was queued and nothing was charged.
    expect(generations.jobs).toHaveLength(0);
    expect(generations.usage.generation).toBe(0);
  });

  it('lets the user insist past the preflight', async () => {
    const posting = 'hire someone good';

    const refused = await rejection(start({ jobDescription: posting }));
    expect(refused.code).toBe('UNPARSEABLE_JOB_DESCRIPTION');

    // `continue_anyway` is not a retry: the same text sent the same way is
    // refused the same way, which would be a loop rather than a way out.
    const job = await start({ jobDescription: posting, acknowledgePreflight: true });
    expect(job.jobId).toBeTruthy();
  });

  it('accepts a posting that reads as one', async () => {
    const posting = [
      'We are seeking a senior backend engineer to join a small platform team.',
      'Responsibilities: designing services, operating them in production, and',
      'mentoring the engineers around you. Requirements: several years of Java,',
      'PostgreSQL, container orchestration and a habit of writing things down.',
      'Preferred qualifications include message queues and infrastructure as code.',
    ].join(' ');

    const job = await start({ jobDescription: posting, acknowledgePreflight: false });

    expect(job.status).toBe('queued');
  });

  it('stops at the quota, with the header a wrong clock cannot spoil', async () => {
    for (let n = 0; n < QUOTA.generation; n += 1) await start();

    const failing = api.post('/generations', { acknowledgePreflight: false });
    const error = await rejection(failing);

    expect(error.status).toBe(429);
    expect(error.code).toBe('QUOTA_EXCEEDED');
    expect(error.params).toMatchObject({ metric: 'generation' });
    // Empty on purpose: the closed vocabulary has no "come back tomorrow",
    // and `retry` would say the opposite of the truth (`B-039`).
    expect(error.resolutions).toEqual([]);
  });

  it('gives the quota back when a job fails', async () => {
    failNextJob();
    const job = await start();
    expect(generations.usage.generation).toBe(1);

    await readStream(job.streamUrl!);

    expect(generations.usage.generation).toBe(0);
  });

  it('brakes ahead of the quota, and says so without saying the account is gone', async () => {
    pauseGeneration();

    const error = await rejection(start());

    expect(error.status).toBe(503);
    expect(error.code).toBe('GENERATION_PAUSED');
    // § 44.3: a paused deployment must not spend an allowance on a request it
    // is about to refuse.
    expect(generations.usage.generation).toBe(0);
  });

  it('answers a repeated Idempotency-Key with the job it already made', async () => {
    const key = 'the-same-double-click';

    const first = await api.post<AcceptedJob>(
      '/generations',
      { acknowledgePreflight: false },
      { idempotencyKey: key },
    );
    const second = await api.post<AcceptedJob>(
      '/generations',
      { acknowledgePreflight: false },
      { idempotencyKey: key },
    );

    expect(second.jobId).toBe(first.jobId);
    expect(generations.jobs).toHaveLength(1);
    // One click, one generation, one charge.
    expect(generations.usage.generation).toBe(1);
  });
});

describe('download and usage', () => {
  it('returns a PDF as an attachment that is never cached', async () => {
    const job = await start();
    await readStream(job.streamUrl!);
    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);

    const response = await fetch(`/api/v1/generations/${status.generationId}/download`);

    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toMatch(/^%PDF-/);
  });

  /**
   * Measured against the running backend: the client's default
   * `Accept: application/json` is refused by an endpoint that produces PDF,
   * and nothing in the mocks noticed until the endpoint was tried for real.
   * The handler negotiates now, so the next client that forgets finds out
   * here rather than in production.
   */
  it('refuses a request that asks it for JSON', async () => {
    const job = await start();
    await readStream(job.streamUrl!);
    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);

    const error = await rejection(api.get(`/generations/${status.generationId}/download`));

    expect(error.status).toBe(406);
  });

  it('answers 410 once the stored content is gone', async () => {
    const job = await start();
    await readStream(job.streamUrl!);
    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);
    expireGeneration(status.generationId!);

    // Through `getFile`, which is what the screen uses: content negotiation
    // happens before the handler, so asking for JSON would be refused with a
    // 406 and this would never reach the state it is testing.
    const error = await rejection(api.getFile(`/generations/${status.generationId}/download`));

    // Not a 404: the generation existed, and the difference is the whole
    // reason the code has its own name.
    expect(error.status).toBe(410);
    expect(error.code).toBe('GENERATION_ARTIFACT_EXPIRED');
  });

  it('reports both metrics, always, as a bare array', async () => {
    await start();

    const usage = await api.get<Usage[]>('/account/usage');

    expect(Array.isArray(usage)).toBe(true);
    // A missing entry would mean "no such metric", never "zero used".
    expect(usage.map((entry) => entry.metric)).toEqual(['generation', 'profile_extract']);
    expect(usage[0]).toMatchObject({ used: 1, limit: QUOTA.generation });
    // An absolute instant, not an hour: the day boundary is UTC and the
    // sentence is written in the user's locale (`F-007`).
    expect(usage[0]!.resetsAt).toMatch(/T00:00:00\.000Z$/);
  });

  /**
   * The counter records attempts, because a refused request takes a unit too
   * — otherwise a user past their limit could hammer the endpoint for free.
   * `used` is that number capped, so the pair a screen prints is always a
   * sensible one and `attempted` keeps the truth beside it (`B-040`).
   */
  it('separates what was spent from what was attempted', async () => {
    for (let n = 0; n < QUOTA.generation; n += 1) await start();
    await rejection(api.post('/generations', { acknowledgePreflight: false }));
    await rejection(api.post('/generations', { acknowledgePreflight: false }));

    const usage = await api.get<Usage[]>('/account/usage');

    expect(usage[0]).toMatchObject({
      used: QUOTA.generation,
      attempted: QUOTA.generation + 2,
      remaining: 0,
    });
    // Never above the limit, so "24 of 20" cannot be printed.
    expect(usage[0]!.used).toBeLessThanOrEqual(usage[0]!.limit!);
  });

  it('agrees with the capability set about the same quota', async () => {
    await start();

    const usage = await api.get<Usage[]>('/account/usage');
    const session = await api.get<{ capabilities: Record<string, number> }>('/auth/session');

    expect(session.capabilities.dailyGenerationQuota).toBe(usage[0]!.limit);
    expect(session.capabilities.generationsUsedToday).toBe(usage[0]!.used);
  });
});

describe('the generation resource', () => {
  it('carries the fit report as counts, and never a percentage', async () => {
    const job = await start({ jobDescription: POSTING, acknowledgePreflight: false });
    await readStream(job.streamUrl!);
    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);

    const generation = await api.get<GenerationResponse>(`/generations/${status.generationId}`);

    expect(generation.fitReport).toMatchObject({
      requiredCovered: 3,
      requiredTotal: 4,
      level: 'MODERATE',
    });
    // § 23.3 forbids a percentage by name: the measurement compares skill
    // names, and a figure to the decimal place reads as a hiring probability.
    expect(JSON.stringify(generation.fitReport)).not.toMatch(/%|percent/i);
  });

  it('omits the report entirely in general mode', async () => {
    const job = await start();
    await readStream(job.streamUrl!);
    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);

    const generation = await api.get<GenerationResponse>(`/generations/${status.generationId}`);

    // Not a row of zeroes: there was no posting to be relevant to, and zero
    // out of zero reads as a bad match rather than as a different question.
    expect(generation.fitReport).toBeUndefined();
    expect(generation.pageCount).toBe(1);
  });

  it('reports the match level on the terminal event too', async () => {
    const job = await start({ jobDescription: POSTING, acknowledgePreflight: false });

    const frames = await readStream(job.streamUrl!);
    const completed = frames[frames.length - 1]!;

    expect(completed.event).toBe('completed');
    expect(completed.data).toMatchObject({ matchLevel: 'MODERATE', pageCount: 1 });
  });
});
