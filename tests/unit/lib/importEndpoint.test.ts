import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importCv } from '@/lib/api/endpoints/profile';
import { isApiError } from '@/lib/api/errors';
import { signIn } from '@/mocks/sessionFixture';
import { server } from '@/mocks/node';

function cv(name = 'cv.pdf', bytes = 'a real CV would go here') {
  return new File([bytes], name, { type: 'application/pdf' });
}

/** Every request the endpoint made, kept whole so the body can be read. */
let sent: Request[] = [];

function capture({ request }: { request: Request }) {
  if (request.url.includes('/profile/import')) sent.push(request.clone());
}

beforeEach(() => {
  sent = [];
  server.events.on('request:start', capture);
});

afterEach(() => server.events.removeListener('request:start', capture));

describe('uploading a CV', () => {
  it('is accepted with a job to follow', async () => {
    const job = await importCv(cv(), { idempotencyKey: 'key-1' });

    expect(job.status).toBe('queued');
    expect(job.jobId).toBeTruthy();
    expect(job.streamUrl).toBe(`/api/v1/jobs/${job.jobId}/stream`);
  });

  /**
   * The header for `multipart/form-data` carries a **boundary**, a token only
   * the browser's serialiser knows. Setting the media type by hand omits it,
   * and the server then cannot split a body whose parts are all there — a
   * `400` about a missing `file` from a request that has one.
   */
  it('lets the browser write the content type, boundary and all', async () => {
    await importCv(cv(), { idempotencyKey: 'key-1' });

    const type = sent[0]!.headers.get('Content-Type');
    expect(type).toMatch(/^multipart\/form-data; boundary=/);
  });

  it('sends exactly one part, named the way the endpoint asks', async () => {
    await importCv(cv('resume.pdf'), { idempotencyKey: 'key-1' });

    const form = await sent[0]!.formData();
    expect([...form.keys()]).toEqual(['file']);
    expect((form.get('file') as File).name).toBe('resume.pdf');
  });

  /**
   * An upload is the request a bad connection retries most readily, and
   * profile extraction is the smallest allowance in the product (§ 44.1).
   */
  it('carries the idempotency key', async () => {
    await importCv(cv(), { idempotencyKey: 'key-1' });

    expect(sent[0]!.headers.get('Idempotency-Key')).toBe('key-1');
  });

  it('collapses a repeat of the same attempt into the job already made', async () => {
    const first = await importCv(cv(), { idempotencyKey: 'key-1' });
    const second = await importCv(cv(), { idempotencyKey: 'key-1' });

    expect(second.jobId).toBe(first.jobId);
  });

  /**
   * `B-060`: `mode` is only ever `replace`, and only as the answer to a
   * `409`. Absent by default, so a typo cannot stand in for consent.
   */
  it('names no mode unless the reader agreed to replace', async () => {
    await importCv(cv(), { idempotencyKey: 'key-1' });
    expect(new URL(sent[0]!.url).search).toBe('');

    await importCv(cv(), { idempotencyKey: 'key-2', replace: true });
    expect(new URL(sent[1]!.url).searchParams.get('mode')).toBe('replace');
  });
});

describe('what a file can be refused for', () => {
  async function refused(file: File, key = 'key-1') {
    const error = await importCv(file, { idempotencyKey: key }).catch((caught: unknown) => caught);
    if (!isApiError(error)) throw new Error('expected an ApiError');
    return error;
  }

  /**
   * § 31.2 runs the checks cheapest first, and the order is not cosmetic: a
   * twelve-megabyte PNG refused for being too large sends the reader off to
   * shrink a file we were never going to read.
   */
  it('refuses the format before it weighs anything', async () => {
    const huge = new File(['x'.repeat(11 * 1024 * 1024)], 'photo.png');
    const error = await refused(huge);

    expect(error.status).toBe(415);
    expect(error.code).toBe('UNSUPPORTED_DOCUMENT');
  });

  /**
   * The accepted list has one owner and the server publishes it here, which
   * is why nothing on the client embeds it (`B-051`).
   */
  it('publishes what it would have accepted', async () => {
    const error = await refused(new File(['x'], 'photo.png'));

    expect(error.params.accepted).toEqual(['pdf', 'docx', 'tex', 'txt', 'md']);
  });

  it('names the limit rather than the size that was sent', async () => {
    const error = await refused(new File(['x'.repeat(11 * 1024 * 1024)], 'cv.pdf'));

    expect(error.status).toBe(413);
    expect(error.params.limitBytes).toBe(10 * 1024 * 1024);
  });

  /**
   * § 31.10 separates these two here and only here. "This may be a scan" is
   * the sentence that stops somebody uploading the same file again.
   */
  it.each([
    ['a password-protected PDF', 'encrypted-cv.pdf', 'PDF_ENCRYPTED'],
    ['a scan', 'scanned-cv.pdf', 'PDF_NOT_TEXT_BASED'],
  ])('tells %s apart', async (_name, filename, code) => {
    const error = await refused(cv(filename));

    expect(error.status).toBe(422);
    expect(error.code).toBe(code);
  });

  it('refuses a file with nothing in it', async () => {
    const error = await refused(new File([], 'cv.pdf'));

    expect(error.code).toBe('EXTRACTION_EMPTY');
  });

  /**
   * `B-060`, and the distinction that makes it work: everyone who signs in
   * once has a profile row, so the test is whether there is anything **in**
   * it. Anonymous callers are outside this entirely (§ 31.6.3).
   */
  it('offers exactly two ways out when an account already has a profile', async () => {
    signIn();
    const error = await refused(cv());

    expect(error.status).toBe(409);
    expect(error.code).toBe('PROFILE_ALREADY_EXISTS');
    expect(error.resolutions.map((resolution) => resolution.action)).toEqual([
      'replace_profile',
      'keep_existing_profile',
    ]);
  });

  it('accepts the same upload once the reader has agreed to replace', async () => {
    signIn();
    await refused(cv());

    const job = await importCv(cv(), { idempotencyKey: 'key-2', replace: true });
    expect(job.jobId).toBeTruthy();
  });

  /**
   * The allowance is spent at the gate and given back when nothing came out
   * (§ 44.2), so a refused file costs nothing — but the quota refusal itself
   * takes a unit, or somebody past their limit could hammer the endpoint for
   * free (`B-040`).
   */
  it('lets a refused file cost nothing', async () => {
    await refused(new File(['x'], 'photo.png'), 'key-1');
    await refused(new File(['x'], 'photo.png'), 'key-2');
    await refused(new File(['x'], 'photo.png'), 'key-3');

    // The anonymous allowance is three. All three above were refused, so this
    // fourth request must still be accepted.
    const job = await importCv(cv(), { idempotencyKey: 'key-4' });
    expect(job.jobId).toBeTruthy();
  });

  it('refuses once the allowance is actually spent', async () => {
    for (const key of ['key-1', 'key-2', 'key-3']) {
      await importCv(cv(), { idempotencyKey: key });
    }

    const error = await refused(cv(), 'key-4');

    expect(error.status).toBe(429);
    expect(error.code).toBe('PROFILE_QUOTA_EXCEEDED');
    expect(error.params.limit).toBe(3);
    // The value the sentence is built from, which a wrong clock cannot spoil.
    expect(error.retryAfterSeconds).toEqual(expect.any(Number));
  });
});
