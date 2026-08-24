import { isServer } from '@tanstack/react-query';
import { NetworkError, toApiError } from './errors';
import { toIfMatch, type Version } from './etag';

/**
 * Same origin by design. In production nginx routes `/api/*` to Spring; in
 * development a rewrite in `next.config.ts` preserves the illusion, which is
 * what keeps `SameSite=Strict` cookies working and CORS out of the picture.
 *
 * Exported because `EventSource` cannot go through this module: it is not
 * `fetch`, takes no headers, and builds its own request. It still needs the
 * same prefix.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

/**
 * PATCH bodies go out as plain JSON.
 *
 * `application/merge-patch+json` was an error in the prose and is now
 * refused with **415** (handoff B-025). Only `EntryPatch` implements RFC
 * 7396's semantics; elsewhere `null` means "leave alone" because the columns
 * cannot be null, so declaring the registered type would have been a false
 * claim. `spec/08-api.md` § 35.6 carries the corrected version.
 *
 * Only the media type is affected. The *semantics* are still merge-patch —
 * an omitted key is left alone, an explicit `null` clears — which is what
 * `buildPatch` is built around. A test pins the media type: "fixing" it back
 * to the registered one breaks every save in the editor.
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
    response = await fetch(`${API_BASE_URL}${path}`, {
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
  if (response.status === 204) return undefined as T;

  // Read as text first. `Content-Length` is not a reliable emptiness check —
  // a chunked or worker-served response can carry no body and no length
  // header at all, and `response.json()` then throws a bare SyntaxError from
  // outside the fetch try/catch.
  //
  // This used to cite the reorder endpoints as the case in point. They are
  // not: the server answers those with the reordered collection, and only a
  // mock ever sent the empty `200`. The guard stays because the hazard is
  // real for any body-less success the status code does not announce as 204.
  const body = await response.text();
  if (body === '') return undefined as T;

  try {
    return JSON.parse(body) as T;
  } catch (cause) {
    throw new NetworkError(cause);
  }
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

/**
 * The server's own name for the file, when it sent one.
 *
 * Deliberately not clever: only the unquoted and double-quoted `filename`
 * forms, no RFC 5987 `filename*`. The caller has a fallback name, and a
 * half-implemented decoder that mangles a Turkish filename is worse than a
 * predictable one.
 */
function filenameFrom(header: string | null): string | undefined {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
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
   * For endpoints that answer with a file rather than a document.
   *
   * Goes through `fetch` rather than a plain link for one reason: a link
   * navigates, and a navigation turns `410 GENERATION_ARTIFACT_EXPIRED` into
   * a page of JSON instead of an error with a way out of it (rule 7). The
   * cost is that the caller owns the object URL and has to revoke it.
   */
  getFile: async (path: string, options?: RequestOptions) => {
    const response = await send('GET', path, undefined, options ?? {});

    return {
      blob: await response.blob(),
      filename: filenameFrom(response.headers.get('Content-Disposition')),
    };
  },

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
