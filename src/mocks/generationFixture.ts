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

import type { FailedEvent } from './contracts';
import type { components } from '@/types/api';

type Schemas = components['schemas'];

/** Which way a job ends. Set by a test through `failNextJob`. */
export type MockOutcome = 'completed' | 'failed';

/**
 * Faz F's coverage report (§ 23.3). **Counts, never a percentage** — the
 * measurement compares skill names, and a figure to the decimal place invites
 * the reader to treat it as a hiring probability.
 *
 * Absent on a general-mode generation: there was no posting to be relevant
 * to, so every number would be zero and zero would read as a bad match.
 */
export type MockFitReport = NonNullable<Schemas['GenerationResponse']['fitReport']>;

export type MockJob = {
  jobId: string;
  generationId: string;
  /** Absent in general mode, exactly as the server omits it. */
  fitReport?: MockFitReport;
  /**
   * B-042's two language axes. Both are absent when blank, as the server
   * sends them, and `postingLanguage` is absent entirely in general mode:
   * there was no posting to read a language off.
   */
  contentLanguage?: string;
  postingLanguage?: string;
  /** Wall-clock ms, the origin of this job's schedule. */
  startedAt: number;
  outcome: MockOutcome;
  /**
   * The error this job reports when it fails. Carried on the job rather than
   * read from the fixture at stream time: the job is created long before
   * anyone subscribes, and a second job enqueued in between would otherwise
   * hand this one its error.
   */
  failure?: FailedEvent;
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
  /** The error the next failing job reports. Absent means the default one. */
  nextFailure?: FailedEvent;
  /**
   * Attempts, not spend. A refused request takes a unit too — otherwise a
   * user past their limit could hammer the endpoint for free (`B-040`) — so
   * this is what `attempted` reports, and `used` is it capped at the limit.
   */
  usage: { generation: number; profile_extract: number };
};

/**
 * The anonymous limits, and they are the same numbers `capabilities`
 * publishes. Two sources for one limit is how a quota screen ends up
 * disagreeing with the error that fired it.
 */
export const QUOTA = { generation: 5, profile_extract: 3 } as const;

/**
 * The account's, which is a different pair rather than a bigger version of
 * the same one (§ 35.7, and `B-046` names the numbers).
 *
 * `sessionFixture.currentQuota()` picks between them, so a signed-in caller's
 * `capabilities` and `/account/usage` still read from one place.
 */
export const ACCOUNT_QUOTA = { generation: 20, profile_extract: 5 } as const;

/**
 * The phase progression, re-measured against the running backend on
 * 2026-08-25, after `B-040`.
 *
 * The **first frame is a snapshot**, sent the moment a client subscribes, and
 * it now carries `{"pct":0}` and nothing else: `phase`, `label` and `detail`
 * are **omitted while empty** rather than sent as `""` (`F-010`, closed). A
 * translation key that is an empty string is not a key, and the shape says so
 * now instead of leaving the client to know it.
 *
 * The five real phases and their `pct` values are the server's, not invented:
 * `ANALYSING` 10, `MEASURING` 30, `SCORING` 50, `REWRITING` 60,
 * `RENDERING` 70.
 *
 * **`REWRITING` does not always happen** (`B-055`). Faz D never runs in
 * general-CV mode, and it is skipped when the posting names no skills, so a
 * bar that jumps 50 → 70 is correct rather than a dropped frame. The mock
 * sends it because a screen that has never seen the phase is the one that
 * renders a blank caption at 60%.
 */
export const SCHEDULE = [
  { at: 0, pct: 0 },
  { at: 400, phase: 'A', label: 'generation.phase.ANALYSING', pct: 10 },
  { at: 800, phase: 'B', label: 'generation.phase.MEASURING', pct: 30 },
  { at: 1200, phase: 'B', label: 'generation.phase.SCORING', pct: 50 },
  { at: 1400, phase: 'D', label: 'generation.phase.REWRITING', pct: 60 },
  { at: 1600, phase: 'C', label: 'generation.phase.RENDERING', pct: 70 },
] as const satisfies readonly { at: number; phase?: string; label?: string; pct: number }[];

/** When the terminal event lands. Nothing is emitted between it and the last phase. */
export const TERMINAL_AT = 2000;

function initial(): GenerationFixture {
  return {
    jobs: [],
    expired: [],
    paused: false,
    nextOutcome: 'completed',
    nextFailure: undefined,
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

/**
 * What a posting-driven generation reports back.
 *
 * Modelled on the shape rather than on one example: two required skills
 * covered out of three is the interesting case, because it is the one where
 * `missingRequired` has something to say and `level` is neither of the
 * extremes.
 */
export const FIT_REPORT: MockFitReport = {
  requiredCovered: 3,
  requiredTotal: 4,
  preferredCovered: 2,
  preferredTotal: 3,
  coveredSkills: ['Java', 'PostgreSQL', 'Kubernetes', 'gRPC', 'CI/CD'],
  // The posting's own words, not our canonical spelling: the reader is
  // looking for the term they read in the advert.
  missingRequired: ['mikroservis'],
  missingPreferred: ['Terraform'],
  level: 'MODERATE',
};

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
export function failNextJob(error?: FailedEvent) {
  generations.nextOutcome = 'failed';
  generations.nextFailure = error;
}

/**
 * § 18.4's gate, refusing **the model's answer** rather than the user's text.
 *
 * Worth having as a fixture because it is the case the result of `B-043` is
 * about: it arrives over the *stream*, not as a 4xx — the preflight is what
 * answers synchronously — and it carries **two** resolutions, not three.
 * `continue_anyway` is absent by design: acknowledging the preflight cannot
 * help with a refusal that happened after the preflight already passed.
 *
 * `suspicious_output` is the one that gets `retry`, and that is not decorative
 * either: the refused analysis is deliberately not cached, so asking again can
 * genuinely come back different.
 */
export function gateRefusal(
  reason: 'low_confidence' | 'too_few_skills' | 'no_responsibilities' | 'suspicious_output',
): FailedEvent {
  const retriable = reason === 'suspicious_output';

  return {
    code: 'UNPARSEABLE_JOB_DESCRIPTION',
    params: {
      reason,
      // Real numbers here, unlike the preflight's zeroes: the gate ran on an
      // analysis. They are also why the sentence must be chosen by `reason` —
      // a confident answer can still be refused for its shape.
      confidence: retriable ? 0.95 : 0.42,
      skillsFound: reason === 'too_few_skills' ? 1 : 8,
    },
    resolutions: retriable
      ? [{ action: 'retry' }, { action: 'continue_as_general_cv' }]
      : [{ action: 'paste_full_posting' }, { action: 'continue_as_general_cv' }],
  };
}

/** Drops a generation's stored content, so `download` answers 410. */
export function expireGeneration(generationId: string) {
  if (!generations.expired.includes(generationId)) generations.expired.push(generationId);
}

export type JobSnapshot = {
  status: NonNullable<Schemas['JobStatusResponse']['status']>;
  /** Absent while there is no phase to name, exactly as the server sends it. */
  phase?: string;
  label?: string;
  pct: number;
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
      ? { status: 'completed', pct: 100, terminal: true }
      : { ...last, status: 'failed', terminal: true };
  }

  const reached = SCHEDULE.filter((step) => elapsed >= step.at);
  const current = reached[reached.length - 1] ?? SCHEDULE[0];

  return { ...current, status: 'phase' in current ? 'running' : 'queued', terminal: false };
}

/** The frames a subscriber that connects `at` has not seen yet. */
export function phasesAfter(job: MockJob, at: number) {
  return SCHEDULE.filter((step) => job.startedAt + step.at > at);
}
