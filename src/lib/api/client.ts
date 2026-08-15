import { isServer } from '@tanstack/react-query';
import { NetworkError, toApiError } from './errors';
import { toIfMatch, type Version } from './etag';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

/**
 * PATCH bodies go out as plain JSON.
 *
 * Bölüm 35.6 specifies `application/merge-patch+json`, and the running
 * backend answers **500** to it while accepting `application/json` — checked
 * directly, not inferred. The published schema agrees with the server: every
 * PATCH declares `application/json` and nothing declares the merge-patch
 * type. Raised in `DOC-SYNC-REQUEST.md`; until it is settled the wire follows
 * the schema, because a client that follows the prose cannot write at all.
 *
 * Only the media type is affected. The *semantics* are still merge-patch —
 * an omitted key is left alone, an explicit `null` clears (D.9 · 16) — which
 * is what `buildPatch` is built around.
 */
const PATCH_CONTENT_TYPE = 'application/json';

export type RequestOptions = {
  /**
   * The version this write is based on, sent as `If-Match`. A stale one gets
   * a 412 (Bölüm 35.6); a missing one gets a 428.
   *
   * Pass the value as it arrived — a bare `version` from a collection item or
   * a quoted `ETag` — and let `toIfMatch` format it. Building the header at a
   * call site is how an unquoted value produces a 412 nobody can explain.
   */
  version?: Version;
  /** Sent as `Idempotency-Key`, so a double click cannot start two jobs. */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

/**
 * A resource together with the version a subsequent write must quote.
 *
 * Only needed where the body does not carry one. Sections, entries, atoms and
 * variants all have a `version` field, so they use plain `api.*`; the profile
 * head and its preferences do not, and the `ETag` header is the only source.
 *
 * `version` can be absent, and the read still succeeds when it is: a screen
 * that only displays the profile has no reason to fail because a header went
 * missing. The write is what fails, and `toIfMatch` names the likely cause.
 */
export type Versioned<T> = { data: T; version?: string };

function assertBrowser(path: string) {
  if (!isServer) return;
  throw new Error(
    `The API client is browser-only, but ${path} was requested during server rendering. ` +
      'Server-side calls need an absolute origin and a way to forward the session cookie; ' +
      'neither is decided yet.',
  );
}

async function send(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions & { contentType?: string } = {},
): Promise<Response> {
  assertBrowser(path);

  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) {
    headers.set('Content-Type', options.contentType ?? 'application/json');
  }
  // Key presence, not value. A caller that names `version` means to send an
  // `If-Match`; if the value turned out to be undefined, that is a bug worth
  // a legible error rather than a request that omits the header and comes
  // back 428 from three layers away.
  if ('version' in options) headers.set('If-Match', toIfMatch(options.version));
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);

  // TODO(csrf): the backend has not defined its CSRF scheme yet — no token
  // name, header name or delivery method is specified anywhere in docs/. The
  // session cookie is SameSite=Strict, which already blocks the cross-site
  // vector; the token is defence in depth and lands with auth in Aşama 3.

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // The session cookie is HttpOnly, so it is never read in JavaScript.
      // This is the only thing that attaches it (Bölüm 40.1).
      credentials: 'include',
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (!response.ok) throw await toApiError(response);

  return response;
}

async function readBody<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions & { contentType?: string } = {},
): Promise<T> {
  return readBody<T>(await send(method, path, body, options));
}

async function requestVersioned<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions & { contentType?: string } = {},
): Promise<Versioned<T>> {
  const response = await send(method, path, body, options);
  const etag = response.headers.get('ETag');

  return { data: await readBody<T>(response), ...(etag ? { version: etag } : {}) };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, undefined, options ?? {}),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options ?? {}),

  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options ?? {}),

  /**
   * As `get`, but keeps the `ETag`. For the profile head and its preferences,
   * whose bodies carry no `version` field.
   */
  getVersioned: <T>(path: string, options?: RequestOptions) =>
    requestVersioned<T>('GET', path, undefined, options ?? {}),

  /** As `put`, keeping the `ETag` the write answers with. */
  putVersioned: <T>(path: string, body: unknown, options?: RequestOptions) =>
    requestVersioned<T>('PUT', path, body, options ?? {}),

  /**
   * For endpoints that answer with something other than JSON. Not every
   * response is a document: `/profile/export?format=markdown` returns
   * `text/markdown`, and reading it as JSON throws on the first character.
   */
  getText: async (path: string, options?: RequestOptions) =>
    (await send('GET', path, undefined, options ?? {})).text(),

  /**
   * Merge-patch semantics: keys you omit are left alone, an explicit `null`
   * clears the field. Build the body with `buildPatch` rather than by hand.
   * Sent as `application/json` — see `PATCH_CONTENT_TYPE`.
   */
  patch: <T>(path: string, body: Record<string, unknown>, options?: RequestOptions) =>
    request<T>('PATCH', path, body, { ...options, contentType: PATCH_CONTENT_TYPE }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options ?? {}),
};
