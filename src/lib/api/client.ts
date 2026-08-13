import { isServer } from '@tanstack/react-query';
import { NetworkError, toApiError } from './errors';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

/** Merge-patch bodies must declare this type so absent keys mean "untouched". */
const MERGE_PATCH_CONTENT_TYPE = 'application/merge-patch+json';

export type RequestOptions = {
  /** Sent as `If-Match`. A stale value gets a 412 (Bölüm 35.6). */
  etag?: string;
  /** Sent as `Idempotency-Key`, so a double click cannot start two jobs. */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

function assertBrowser(path: string) {
  if (!isServer) return;
  throw new Error(
    `The API client is browser-only, but ${path} was requested during server rendering. ` +
      'Server-side calls need an absolute origin and a way to forward the session cookie; ' +
      'neither is decided yet.',
  );
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions & { contentType?: string } = {},
): Promise<T> {
  assertBrowser(path);

  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) {
    headers.set('Content-Type', options.contentType ?? 'application/json');
  }
  if (options.etag) headers.set('If-Match', options.etag);
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

  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, undefined, options ?? {}),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options ?? {}),

  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options ?? {}),

  /**
   * JSON Merge Patch. Keys you omit are left alone; an explicit `null`
   * clears the field. Build the body with `buildPatch` rather than by hand.
   */
  patch: <T>(path: string, body: Record<string, unknown>, options?: RequestOptions) =>
    request<T>('PATCH', path, body, { ...options, contentType: MERGE_PATCH_CONTENT_TYPE }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options ?? {}),
};
