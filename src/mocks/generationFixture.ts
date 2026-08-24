/**
 * Mutable state for the generation endpoints.
 *
 * Stateful for the same reason `profileFixture.ts` is: the behaviour worth
 * mocking is not a payload. A job moves through phases on its own clock, a
 * quota counter climbs, an `Idempotency-Key` returns the job it already
 * made — none of that can be expressed by a handler returning a fixed body.
 *
 * **A job advances on wall-clock time, not on subscription.** The real worker
 * runs whether or not anyone is watching, and the difference is load-bearing:
 * a job that finishes between the 202 and the subscribe has to send its
 * outcome rather than nothing at all (§ 30.6), and that case only exists if
 * the job can finish unobserved.
 *
 * Types come from the generated schema wherever the schema has one. The SSE
 * payloads are the exception and `contracts.ts` says why.
 */

import type { components } from '@/types/api';

type Schemas = components['schemas'];

/** Which way a job ends. Set by a test through `failNextJob`. */
export type MockOutcome = 'completed' | 'failed';

export type MockJob = {
  jobId: string;
  generationId: string;
  /** Wall-clock ms, the origin of this job's schedule. */
  startedAt: number;
  outcome: MockOutcome;
  idempotencyKey?: string;
};

export type GenerationFixture = {
  jobs: MockJob[];
  /** Generations whose stored content is gone — `download` answers 410. */
  expired: string[];
  /** § 44.3's kill switch. Generation stops; reading a profile does not. */
  paused: boolean;
  /** The outcome the next accepted job gets. Reset after it is claimed. */
  nextOutcome: MockOutcome;
  usage: { generation: number; profile_extract: number };
};

/**
 * The anonymous limits, and they are the same numbers `capabilities`
 * publishes. Two sources for one limit is how a quota screen ends up
 * disagreeing with the error that fired it.
 */
export const QUOTA = { generation: 5, profile_extract: 3 } as const;

/**
 * The phase progression, measured against the running backend on 2026-08-24.
 *
 * Two details are reproduced deliberately because the client has to survive
 * them (`F-010`): the **first frame is a snapshot** sent the moment a client
 * subscribes, and it carries empty strings rather than dropping the fields.
 * `label` is a translation key (`B-038`), so an empty one is not a key — the
 * client must read it as "no phase yet" instead of translating
 * `generation.phase.`.
 *
 * The four real phases and their `pct` values are the server's, not invented:
 * `ANALYSING` 10, `MEASURING` 30, `SCORING` 50, `RENDERING` 70.
 */
export const SCHEDULE = [
  { at: 0, phase: '', label: '', pct: 0, detail: '' },
  { at: 400, phase: 'A', label: 'generation.phase.ANALYSING', pct: 10, detail: '' },
  { at: 800, phase: 'B', label: 'generation.phase.MEASURING', pct: 30, detail: '' },
  { at: 1200, phase: 'B', label: 'generation.phase.SCORING', pct: 50, detail: '' },
  { at: 1600, phase: 'C', label: 'generation.phase.RENDERING', pct: 70, detail: '' },
] as const;

/** When the terminal event lands. Nothing is emitted between it and the last phase. */
export const TERMINAL_AT = 2000;

function initial(): GenerationFixture {
  return {
    jobs: [],
    expired: [],
    paused: false,
    nextOutcome: 'completed',
    usage: { generation: 0, profile_extract: 0 },
  };
}

export let generations: GenerationFixture = initial();

/**
 * Called between tests, like `resetProfileFixture`. A quota counter that
 * survived a test would make the fifth test in a file fail on a limit the
 * fourth one used up.
 */
export function resetGenerationFixture() {
  generations = initial();
}

/** § 44.3's brake, for the test that asserts the paused screen. */
export function pauseGeneration(paused = true) {
  generations.paused = paused;
}

/**
 * Makes the next accepted job end in `failed`.
 *
 * A switch rather than a magic value in the request, because there is no
 * request-shaped trigger for the failures that matter here: a compiler that
 * fell over and a provider chain that did not answer are conditions of the
 * server, not of what the client asked for. Encoding one as a special
 * `jobDescription` would teach product code a string the real server ignores.
 */
export function failNextJob() {
  generations.nextOutcome = 'failed';
}

/** Drops a generation's stored content, so `download` answers 410. */
export function expireGeneration(generationId: string) {
  if (!generations.expired.includes(generationId)) generations.expired.push(generationId);
}

export type JobSnapshot = {
  status: NonNullable<Schemas['JobStatusResponse']['status']>;
  phase: string;
  label: string;
  pct: number;
  detail: string;
  terminal: boolean;
};

/**
 * Where a job is, computed from elapsed time rather than stored.
 *
 * Derived state has no scheduler to leak: nothing has to be cancelled when a
 * test ends, and two readers — the stream and `GET /jobs/{id}` — cannot
 * disagree, which is the reconciliation the fallback exists to provide.
 */
export function jobSnapshot(job: MockJob, now = Date.now()): JobSnapshot {
  const elapsed = now - job.startedAt;

  if (elapsed >= TERMINAL_AT) {
    // A failed job keeps where it stopped: `pct` is the most useful thing
    // known about it, and a bar that jumps to 100 to say "failed" is a lie
    // (`B-038`). A completed one reports 100 and sends no phase at all.
    const last = SCHEDULE[SCHEDULE.length - 1]!;

    return job.outcome === 'completed'
      ? { status: 'completed', phase: '', label: '', pct: 100, detail: '', terminal: true }
      : { ...last, status: 'failed', terminal: true };
  }

  const reached = SCHEDULE.filter((step) => elapsed >= step.at);
  const current = reached[reached.length - 1] ?? SCHEDULE[0];

  return { ...current, status: current.phase === '' ? 'queued' : 'running', terminal: false };
}

/** The frames a subscriber that connects `at` has not seen yet. */
export function phasesAfter(job: MockJob, at: number) {
  return SCHEDULE.filter((step) => job.startedAt + step.at > at);
}
