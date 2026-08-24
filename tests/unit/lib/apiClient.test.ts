import { describe, expect, it } from 'vitest';
import { api } from '@/lib/api/client';
import { ApiError, isApiError, isRetriable } from '@/lib/api/errors';
import type { SessionResponse } from '@/mocks/contracts';
import type { components } from '@/types/api';

/**
 * Exercises the client against the same MSW handlers the browser uses, so
 * these assertions describe real behaviour rather than a test-only fake.
 */
type AcceptedJob = components['schemas']['AcceptedJobResponse'];

describe('api client', () => {
  it('reads the anonymous capability set', async () => {
    const session = await api.get<SessionResponse>('/auth/session');

    expect(session.authenticated).toBe(false);
    // The UI must gate on this object, never on assumptions about what
    // anonymous users can do (Bölüm 35.7).
    expect(session.capabilities.allowedLanguages).toEqual(['en']);
    expect(session.capabilities.canCustomizeTemplate).toBe(false);
    expect(session.capabilities.maxAtoms).toBe(60);
  });

  it('accepts a valid generation request with 202 and a job', async () => {
    // No `jobDescription`: its absence is general mode (§ 35.3), and the
    // preflight has nothing to refuse.
    const job = await api.post<AcceptedJob>('/generations', { acknowledgePreflight: false });

    expect(job.status).toBe('queued');
    expect(job.jobId).toBeTruthy();
    expect(job.streamUrl).toBe(`/api/v1/jobs/${job.jobId}/stream`);
  });
});

describe('preflight failures', () => {
  /**
   * § 18.1 and § 35.3: a request that cannot work is refused before a job
   * is queued, and the refusal carries the ways out. Rule 7 turns those into
   * buttons, so what matters is that they survive the round trip intact.
   */
  it('surfaces code, params and resolutions from a 422', async () => {
    const failing = api.post('/generations', {
      jobDescription: 'hire someone good',
      acknowledgePreflight: false,
    });

    await expect(failing).rejects.toBeInstanceOf(ApiError);

    const error = await failing.catch((caught: unknown) => caught);

    if (!isApiError(error)) throw new Error('expected an ApiError');

    expect(error.status).toBe(422);
    expect(error.code).toBe('UNPARSEABLE_JOB_DESCRIPTION');
    expect(error.translationKey).toBe('errors.UNPARSEABLE_JOB_DESCRIPTION');
    // Both zero: the preflight measured the text, it did not analyse it.
    expect(error.params).toMatchObject({ confidence: 0, skillsFound: 0 });
    // § 18.1's three ways out, in its order — insisting comes first because
    // it is the only one that does not throw the user's text away.
    expect(error.resolutions.map((resolution) => resolution.action)).toEqual([
      'continue_anyway',
      'paste_full_posting',
      'continue_as_general_cv',
    ]);
  });

  it('does not retry a deterministic 4xx', async () => {
    const error = new ApiError({ status: 409, code: 'CONFLICTING_PREFERENCES' });
    expect(isRetriable(error)).toBe(false);
  });

  it('retries a 5xx, where a second attempt can genuinely differ', () => {
    expect(isRetriable(new ApiError({ status: 503, code: 'ALL_PROVIDERS_UNAVAILABLE' }))).toBe(
      true,
    );
  });

  /**
   * A quota is a decision the user has to see, not something to paper over
   * by retrying until it works (Bölüm 44.1).
   */
  it('does not retry a quota rejection', () => {
    expect(isRetriable(new ApiError({ status: 429, code: 'QUOTA_EXCEEDED' }))).toBe(false);
  });
});
