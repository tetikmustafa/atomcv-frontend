/**
 * Double-submit CSRF (`B-044`, `spec/08b-api-contract.md` § EK D.6.6).
 *
 * The server puts a **readable** `XSRF-TOKEN` cookie on every response; the
 * client echoes it in `X-XSRF-TOKEN` on unsafe methods. A write that does not
 * echo is answered `403 CSRF_TOKEN_INVALID`.
 *
 * This cookie is deliberately not `HttpOnly` — it has to be read — and that
 * does not weaken rule 10: the session lives in `sid`, which stays
 * `HttpOnly`, and this token proves nothing on its own.
 *
 * **The trap is the origin.** The cookie is `SameSite=Strict` and host-bound,
 * so a page on `:3000` cannot see a cookie set by `:8080` — `document.cookie`
 * comes back empty and every write 403s. Everything must go through the
 * same-origin rewrite in `next.config.ts`, the OAuth callback included. That
 * is the same reason the rewrite exists at all, not a second one.
 */

const COOKIE_NAME = 'XSRF-TOKEN';

export const CSRF_HEADER = 'X-XSRF-TOKEN';

/**
 * The methods the server guards. Spring's own set, and `GET` is absent on
 * purpose: a read that demanded a token could not be the request that
 * *obtains* one, which is exactly what the magic-link page needs (`B-049`).
 */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

/**
 * The token as it stands right now, or `undefined` before the first response
 * has set one.
 *
 * Read per request rather than cached: the server may rotate it, and a client
 * holding the old value would send a stale token forever. `CSRF_TOKEN_INVALID`
 * is therefore **not retried** — a repeat of the same request would carry the
 * same cached token. Re-reading is the fix, and reading here means the next
 * request already does it.
 */
export function readCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;

  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== COOKIE_NAME) continue;

    // Cookie values are percent-encoded on the way out. A token containing
    // `+` or `=` survives the round trip only if it is decoded here.
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      // Malformed encoding: send it as it arrived rather than dropping the
      // header, so the server decides instead of the client guessing.
      return raw;
    }
  }

  return undefined;
}
