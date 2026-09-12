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
import { DOCX_MEDIA_TYPE } from '@/mocks/generationHandlers';
import { fixture } from '@/mocks/profileFixture';
import type { components } from '@/types/api';

type AcceptedJob = components['schemas']['AcceptedJobResponse'];
type JobStatus = components['schemas']['JobStatusResponse'];
type Usage = components['schemas']['Usage'];
type GenerationResponse = components['schemas']['GenerationResponse'];
type GenerationPage = components['schemas']['GenerationPage'];
type SelectionView = components['schemas']['SelectionViewResponse'];

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

/**
 * Faz G (§ 24, `B-088` and `B-089`).
 *
 * What is worth pinning is the arithmetic the history and the deletion screen
 * both rest on: twenty edits are twenty-one generations and **one CV**. And
 * the difference between the two endpoints, which the screen states out loud
 * — the hand toggle is free, the sentence is not.
 */
describe('editing a finished generation', () => {
  /** The atoms this profile has, so a sentence can name one. */
  const NAMES_AN_ATOM = 'take out the query monitor bullet';

  async function finished() {
    const job = await start();
    await readStream(job.streamUrl!);
    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);
    return status.generationId!;
  }

  it('answers with a job, and the job makes a different generation', async () => {
    const generationId = await finished();

    const accepted = await api.post<AcceptedJob>(`/generations/${generationId}/edits`, {
      instruction: NAMES_AN_ATOM,
    });
    await readStream(accepted.streamUrl!);
    const outcome = await api.get<JobStatus>(`/jobs/${accepted.jobId}`);

    expect(outcome.generationId).not.toBe(generationId);
  });

  /**
   * `B-088`'s fourth item, and the one with a screen behind it: `total` is
   * what the deletion confirmation states, and it counts **CVs** now rather
   * than rows. A history that listed the retired one would say a person has
   * twice as many resumes as they have.
   */
  it('drops the edited generation from the history, and from the total', async () => {
    const generationId = await finished();
    const before = await api.get<GenerationPage>('/generations');
    expect(before.total).toBe(1);

    const accepted = await api.post<AcceptedJob>(`/generations/${generationId}/edits`, {
      instruction: NAMES_AN_ATOM,
    });
    await readStream(accepted.streamUrl!);

    const after = await api.get<GenerationPage>('/generations');

    expect(after.total).toBe(1);
    expect(after.items?.map((row) => row.generationId)).not.toContain(generationId);
  });

  /**
   * The other half of the same promise: the retired row does not disappear.
   * A CV already sent to an employer still reads back and still downloads.
   */
  it('keeps the edited generation readable, marked superseded', async () => {
    const generationId = await finished();
    const accepted = await api.post<AcceptedJob>(`/generations/${generationId}/edits`, {
      instruction: NAMES_AN_ATOM,
    });
    await readStream(accepted.streamUrl!);

    const retired = await api.get<GenerationResponse>(`/generations/${generationId}`);
    const file = await api.getFile(`/generations/${generationId}/download`);

    expect(retired.status).toBe('superseded');
    expect(file.blob.size).toBeGreaterThan(0);
  });

  it('refuses a second edit of the same generation', async () => {
    const generationId = await finished();
    const accepted = await api.post<AcceptedJob>(`/generations/${generationId}/edits`, {
      instruction: NAMES_AN_ATOM,
    });
    await readStream(accepted.streamUrl!);

    const error = await rejection(
      api.post(`/generations/${generationId}/edits`, { instruction: NAMES_AN_ATOM }),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('GENERATION_SUPERSEDED');
    // No way out: the server offers none, and the client must not invent one.
    expect(error.resolutions ?? []).toHaveLength(0);
  });

  /**
   * The difference the screen has to say out loud. A toggle is deterministic
   * — a compilation and no more — so it takes nothing off the day.
   */
  it('charges the sentence and not the hand toggle', async () => {
    const first = await finished();
    const spentOnGenerating = generations.usage.generation;

    const toggled = await api.post<AcceptedJob>(`/generations/${first}/selection`, {
      exclude: [fixture.atoms[0]!.id],
    });
    await readStream(toggled.streamUrl!);
    expect(generations.usage.generation).toBe(spentOnGenerating);

    const second = (await api.get<JobStatus>(`/jobs/${toggled.jobId}`)).generationId!;
    const written = await api.post<AcceptedJob>(`/generations/${second}/edits`, {
      instruction: NAMES_AN_ATOM,
    });
    await readStream(written.streamUrl!);

    expect(generations.usage.generation).toBe(spentOnGenerating + 1);
    // Three streams at two seconds each, so the default five is not enough.
  }, 20_000);

  /**
   * § 24.2: the refusal is the design, not a fault — removing the wrong
   * bullet is worse than doing nothing, because the reader may not notice.
   * And the allowance comes back, which is the half a screen would otherwise
   * have to guess at.
   */
  it('refuses a sentence it matched nothing to, and refunds it', async () => {
    const generationId = await finished();
    const spent = generations.usage.generation;

    const error = await rejection(
      api.post(`/generations/${generationId}/edits`, {
        instruction: 'please make the whole thing sound friendlier',
      }),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('EDIT_NOT_UNDERSTOOD');
    expect(error.resolutions?.map((resolution) => resolution.action)).toEqual(['retry']);
    expect(generations.usage.generation).toBe(spent);
  });

  /**
   * An atom this generation never weighed is refused rather than ignored:
   * ignoring it would answer 202 and hand back the same document, which is
   * indistinguishable from a bug.
   *
   * "Never weighed" is measured against the **generation's** lines rather
   * than against the profile (`B-097`). That is the whole reason the read
   * endpoint had to exist: a screen drawn from today's atoms would offer
   * buttons that answer 400.
   */
  it('refuses an unknown atom and an atom named on both sides', async () => {
    const generationId = await finished();
    const known = fixture.atoms[0]!.id;

    const unknown = await rejection(
      api.post(`/generations/${generationId}/selection`, { exclude: ['no-such-atom'] }),
    );
    expect(unknown.status).toBe(400);
    expect(unknown.params?.fields).toEqual(['no-such-atom']);

    const both = await rejection(
      api.post(`/generations/${generationId}/selection`, { include: [known], exclude: [known] }),
    );
    expect(both.status).toBe(400);
    expect(both.params?.fields).toEqual([known]);

    const empty = await rejection(api.post(`/generations/${generationId}/selection`, {}));
    expect(empty.status).toBe(400);
  });

  /**
   * The terminal event names the generation that **was** edited, so a screen
   * holding the old id learns where it went without re-reading the history.
   *
   * **And the poll says the same** (`B-098`). It used to travel on the stream
   * alone, because the schema published neither this nor `matchLevel`: a
   * stream that dropped took the answer with it, and a client reading either
   * field did not compile (`F-032`). Both transports are asserted together
   * here, because one of them carrying it is exactly the bug.
   */
  it('names the replaced generation on the terminal event and on the poll', async () => {
    const generationId = await finished();
    const accepted = await api.post<AcceptedJob>(`/generations/${generationId}/edits`, {
      instruction: NAMES_AN_ATOM,
    });

    const frames = await readStream(accepted.streamUrl!);
    const completed = frames.find((candidate) => candidate.event === 'completed')!;
    const polled = await api.get<JobStatus>(`/jobs/${accepted.jobId}`);

    expect((completed.data as { supersededGenerationId?: string }).supersededGenerationId).toBe(
      generationId,
    );
    expect(polled.supersededGenerationId).toBe(generationId);
    expect(polled.matchLevel).toBe((completed.data as { matchLevel?: string }).matchLevel);
  });

  /**
   * General mode has no posting to be relevant to, so there is no level to
   * report — absent rather than a floor value, on both transports. A default
   * of `WEAK` would read as a bad match where there was nothing to match.
   */
  it('sends no match level where there was no posting', async () => {
    const job = await api.post<AcceptedJob>('/generations', { acknowledgePreflight: false });
    const frames = await readStream(job.streamUrl!);
    const completed = frames.find((candidate) => candidate.event === 'completed')!;

    expect((completed.data as { matchLevel?: string }).matchLevel).toBeUndefined();
    expect((await api.get<JobStatus>(`/jobs/${job.jobId}`)).matchLevel).toBeUndefined();
  });

  /**
   * `B-097`. The list the hand toggle is drawn from, and the endpoint that
   * made drawing one possible at all.
   */
  describe('what a generation weighed', () => {
    it('publishes every line, on-page ones first', async () => {
      const generationId = await finished();

      const view = await api.get<SelectionView>(`/generations/${generationId}/selection`);
      const lines = view.lines ?? [];

      expect(view.generationId).toBe(generationId);
      expect(lines.length).toBe(fixture.atoms.length);

      // Ordering rather than an exact arrangement: the promise is "on the page
      // first, then what the budget held back", and a count would pass on a
      // list that was sorted the other way round.
      const held = lines.findIndex((line) => line.onPage !== true);
      expect(held).toBeGreaterThan(0);
      expect(lines.slice(held).every((line) => line.onPage !== true)).toBe(true);
    });

    /**
     * The equivalence the endpoint exists for: every id it publishes is one the
     * edit endpoint takes. A screen cannot be written against half of it.
     */
    it('publishes only ids the edit endpoint accepts', async () => {
      const generationId = await finished();
      const view = await api.get<SelectionView>(`/generations/${generationId}/selection`);

      const held = (view.lines ?? []).find((line) => line.onPage !== true)!;
      const accepted = await api.post<AcceptedJob>(`/generations/${generationId}/selection`, {
        include: [held.atomId],
      });

      expect(accepted.jobId).toBeTruthy();
    });

    /**
     * § 24.4: the edit applies to the **selection state**, so the generation it
     * makes carries the old selection with the toggles moved rather than a
     * fresh weighing. It is what keeps the page limit true after twenty edits,
     * and what lets a second edit see what the first one did.
     */
    it('carries the selection into the generation an edit makes', async () => {
      const generationId = await finished();
      const before = await api.get<SelectionView>(`/generations/${generationId}/selection`);
      const held = (before.lines ?? []).find((line) => line.onPage !== true)!;

      const accepted = await api.post<AcceptedJob>(`/generations/${generationId}/selection`, {
        include: [held.atomId],
      });
      await readStream(accepted.streamUrl!);
      const replacement = (await api.get<JobStatus>(`/jobs/${accepted.jobId}`)).generationId!;

      const after = await api.get<SelectionView>(`/generations/${replacement}/selection`);
      const moved = (after.lines ?? []).find((line) => line.atomId === held.atomId);

      expect(moved?.onPage).toBe(true);
      expect(after.lines?.length).toBe(before.lines?.length);
    });

    /**
     * The text is the one **this** CV printed. A list drawn from today's
     * profile would offer to remove a sentence that is not on the page, and
     * § 24.2 numbers these lines for the model on the same grounds.
     */
    it('keeps the wording the CV printed after the atom is reworded', async () => {
      const generationId = await finished();
      const before = await api.get<SelectionView>(`/generations/${generationId}/selection`);
      const first = (before.lines ?? [])[0]!;

      const atom = fixture.atoms.find((candidate) => candidate.id === first.atomId)!;
      const primary = (atom.variants ?? []).find((variant) => variant.primary)!;
      primary.plainText = 'Something else entirely';

      const after = await api.get<SelectionView>(`/generations/${generationId}/selection`);

      expect(after.lines?.[0]?.text).toBe(first.text);
      expect(after.lines?.[0]?.text).not.toBe('Something else entirely');
    });

    /**
     * A retired generation still answers: the screen that shows one has to say
     * why its toggles are gone, and it reads the same list to do it.
     */
    it('names the generation that replaced a retired one', async () => {
      const generationId = await finished();
      const accepted = await api.post<AcceptedJob>(`/generations/${generationId}/edits`, {
        instruction: NAMES_AN_ATOM,
      });
      await readStream(accepted.streamUrl!);
      const replacement = (await api.get<JobStatus>(`/jobs/${accepted.jobId}`)).generationId!;

      const retired = await api.get<GenerationResponse>(`/generations/${generationId}`);
      const newest = await api.get<GenerationResponse>(`/generations/${replacement}`);

      expect(retired.supersededByGenerationId).toBe(replacement);
      // Only on a retired row: the newest one has nothing after it, and a
      // self-reference or an empty string would both draw a link to nowhere.
      expect(newest.supersededByGenerationId).toBeUndefined();
    });
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

  /**
   * `B-094`: the same generation, a second format. Genuinely a zip, because
   * the handler is what the dev harness downloads and a Word file Word
   * refuses would look like a bug in the client rather than in the mock.
   */
  it('serves the same generation as a Word document', async () => {
    const job = await start();
    await readStream(job.streamUrl!);
    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);

    const response = await fetch(`/api/v1/generations/${status.generationId}/download?format=docx`);

    expect(response.headers.get('Content-Type')).toBe(DOCX_MEDIA_TYPE);
    expect(response.headers.get('Content-Disposition')).toContain('.docx');

    // `PK\u0003\u0004` — the local file header every zip starts with, and an
    // OPC package is a zip.
    const head = new Uint8Array(await response.arrayBuffer()).subarray(0, 4);
    expect(Array.from(head)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  /**
   * \u00a7 35.3's map names a third format and nothing serves it. A silent PDF
   * would make a "download the source" button hand back a PDF, which nobody
   * would notice until they opened it \u2014 so the refusal is encoded.
   */
  it('refuses the source format rather than quietly sending a PDF', async () => {
    const job = await start();
    await readStream(job.streamUrl!);
    const status = await api.get<JobStatus>(`/jobs/${job.jobId}`);

    const error = await rejection(
      api.getFile(`/generations/${status.generationId}/download?format=source`),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.params?.fields).toEqual(['format']);
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

  /**
   * `F-025`, § 18.4.1: the employer is a name the posting carries or it is
   * nothing. Both rows come from the same posting, so what is asserted is the
   * rule rather than which fixture was picked — and the second is the row the
   * wire produces most often, a role with no company at all.
   *
   * The old mock wrote both names together and could not produce it, which is
   * how `"not specified"` reached a screen before anybody had rendered the
   * half-labelled row.
   */
  it('names the employer only when the posting does', async () => {
    const named = await start({
      jobDescription: `Acme is hiring. ${POSTING}`,
      acknowledgePreflight: false,
    });
    await readStream(named.streamUrl!);

    const unnamed = await start({ jobDescription: POSTING, acknowledgePreflight: false });
    await readStream(unnamed.streamUrl!);

    const page = await api.get<{ items: { roleTitle?: string; companyName?: string }[] }>(
      '/generations?limit=10',
    );

    // Newest first, so the posting without the name leads.
    expect(page.items[0]).toMatchObject({ roleTitle: 'Senior Backend Engineer' });
    expect(page.items[0]!.companyName).toBeUndefined();
    expect(page.items[1]).toMatchObject({ companyName: 'Acme' });
  });

  it('reports the match level on the terminal event too', async () => {
    const job = await start({ jobDescription: POSTING, acknowledgePreflight: false });

    const frames = await readStream(job.streamUrl!);
    const completed = frames[frames.length - 1]!;

    expect(completed.event).toBe('completed');
    expect(completed.data).toMatchObject({ matchLevel: 'MODERATE', pageCount: 1 });
  });
});
