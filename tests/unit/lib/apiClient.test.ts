import { describe, expect, it } from 'vitest';
import { api } from '@/lib/api/client';
import { ApiError, isApiError, isRetriable } from '@/lib/api/errors';
import type { SessionResponse } from '@/mocks/contracts';

/**
 * Exercises the client against the same MSW handlers the browser uses, so
 * these assertions describe real behaviour rather than a test-only fake.
 */
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
    const job = await api.post<{ jobId: string; status: string }>('/generations', {
      jobDescription: 'Senior Backend Engineer',
      options: { maxPages: 1 },
    });

    expect(job.status).toBe('queued');
    expect(job.jobId).toBeTruthy();
  });
});

describe('preflight failures', () => {
  /**
   * Bölüm 11.4 and 35.3: an impossible request is refused before a job is
   * queued, and the refusal carries the ways out. Rule 7 turns those into
   * buttons, so what matters is that they survive the round trip intact.
   */
  it('surfaces code, params and resolutions from a 409', async () => {
    const failing = api.post('/generations', {
      jobDescription: 'Senior Backend Engineer',
      directives: { includeAtoms: ['a', 'b', 'c', 'd', 'e'] },
      options: { maxPages: 1 },
    });

    await expect(failing).rejects.toBeInstanceOf(ApiError);

    const error = await failing.catch((caught: unknown) => caught);

    if (!isApiError(error)) throw new Error('expected an ApiError');

    expect(error.status).toBe(409);
    expect(error.code).toBe('CONFLICTING_PREFERENCES');
    expect(error.translationKey).toBe('errors.CONFLICTING_PREFERENCES');
    expect(error.params).toMatchObject({ maxPages: 1 });
    expect(error.resolutions.map((resolution) => resolution.action)).toEqual([
      'increase_page_limit',
      'review_pins',
      'keep_top_pinned',
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
