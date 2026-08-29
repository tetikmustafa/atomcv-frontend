import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { api } from '@/lib/api/client';
import { ApiError, isApiError, isRetriable } from '@/lib/api/errors';
import { getSession, requestMagicLink } from '@/lib/api/endpoints/auth';
import { toErrorLike } from '@/lib/errors/errorLike';
import { server } from '@/mocks/node';
import { problem } from '@/mocks/problem';
import type { components } from '@/types/api';

/**
 * Exercises the client against the same MSW handlers the browser uses, so
 * these assertions describe real behaviour rather than a test-only fake.
 */
type AcceptedJob = components['schemas']['AcceptedJobResponse'];

describe('api client', () => {
  it('reads the anonymous capability set', async () => {
    const session = await getSession();

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

/**
 * `B-050` wants a rate-limit sentence built from `Retry-After` rather than
 * from the absolute `resetsAt` in the body, because a duration survives a
 * reader whose clock is wrong. The header is the one part of an error that
 * does not travel in the problem document, so it needs its own carriage.
 */
describe('the wait a 429 asks for', () => {
  async function refused(): Promise<ApiError> {
    // Four requests: § 40.5's address layer allows three per window.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await requestMagicLink({ email: 'someone@example.com' });
    }

    const error = await requestMagicLink({ email: 'someone@example.com' }).catch(
      (caught: unknown) => caught,
    );

    if (!isApiError(error)) throw new Error('expected an ApiError');
    return error;
  }

  it('carries the header through as seconds', async () => {
    const error = await refused();

    expect(error.status).toBe(429);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryAfterSeconds).toBe(900);
  });

  /**
   * The header and the body are two different facts, and the client keeps
   * both: `resetsAt` still arrives, it is simply not what the sentence is
   * built from.
   */
  it('keeps the instant from the body beside it', async () => {
    expect((await refused()).params.resetsAt).toEqual(expect.any(String));
  });

  it('reaches the renderer through the shared error shape', async () => {
    expect(toErrorLike(await refused()).retryAfterSeconds).toBe(900);
  });

  /**
   * Everything else has no header at all, and must not acquire one: a
   * fabricated duration would be a promise about when a retry works.
   */
  it('is absent where the response carried none', async () => {
    const error = await api
      .post('/generations', { jobDescription: 'hire someone good', acknowledgePreflight: false })
      .catch((caught: unknown) => caught);

    if (!isApiError(error)) throw new Error('expected an ApiError');
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  /**
   * RFC 7231 also allows an HTTP-date, and this deliberately does not read
   * one. Treating it as absent puts the reader on the "shortly" branch; a
   * half-implemented parser would put a wrong number of minutes on screen.
   */
  it('ignores a form it does not parse rather than guessing', async () => {
    server.use(
      http.post('*/api/v1/auth/magic-link', () =>
        HttpResponse.json(problem(429, 'RATE_LIMITED', '/api/v1/auth/magic-link'), {
          status: 429,
          headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' },
        }),
      ),
    );

    const error = await requestMagicLink({ email: 'someone@example.com' }).catch(
      (caught: unknown) => caught,
    );

    if (!isApiError(error)) throw new Error('expected an ApiError');
    expect(error.retryAfterSeconds).toBeUndefined();
  });
});
