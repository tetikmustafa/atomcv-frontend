import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { api } from '@/lib/api/client';
import { server } from '@/mocks/node';

/**
 * `B-044`: double submit. The server sets a readable `XSRF-TOKEN` cookie and
 * refuses any unsafe method that does not echo it in `X-XSRF-TOKEN`.
 *
 * Worth pinning rather than trusting, because both failure directions are
 * silent in development: MSW never checks the header, so a client that
 * stopped sending it passes every other test in this suite and 403s on the
 * first write against the real backend.
 */

const COOKIE = 'XSRF-TOKEN';

function setToken(value: string) {
  document.cookie = `${COOKIE}=${value}; path=/`;
}

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

afterEach(clearCookies);

describe('the CSRF token', () => {
  it('is echoed on a write', async () => {
    let seen: string | null = null;
    server.use(
      http.post('*/api/v1/profile/sections', ({ request }) => {
        seen = request.headers.get('X-XSRF-TOKEN');
        return HttpResponse.json({ id: 'sec-1', version: 0 });
      }),
    );

    setToken('token-from-the-cookie');
    await api.post('/profile/sections', { title: 'Experience' });

    expect(seen).toBe('token-from-the-cookie');
  });

  it('is decoded on the way out', async () => {
    let seen: string | null = null;
    server.use(
      http.post('*/api/v1/profile/sections', ({ request }) => {
        seen = request.headers.get('X-XSRF-TOKEN');
        return HttpResponse.json({ id: 'sec-1', version: 0 });
      }),
    );

    // Percent-encoded in the cookie jar, which is where a `+` or an `=` in a
    // base64 token ends up. Sent raw, the server compares against a value
    // that never matches.
    setToken(encodeURIComponent('a+b/c=='));
    await api.post('/profile/sections', { title: 'Experience' });

    expect(seen).toBe('a+b/c==');
  });

  it('is not sent on a read', async () => {
    let seen: string | null = 'not asked';
    server.use(
      http.get('*/api/v1/profile/sections', ({ request }) => {
        seen = request.headers.get('X-XSRF-TOKEN');
        return HttpResponse.json([]);
      }),
    );

    setToken('token-from-the-cookie');
    await api.get('/profile/sections');

    // Not merely unnecessary. The magic-link page has to `GET /auth/session`
    // precisely to *obtain* this cookie (`B-049`), so a read that required
    // one could never be the request that gets it.
    expect(seen).toBeNull();
  });

  it('sends no header at all when there is no cookie yet', async () => {
    let present = true;
    server.use(
      http.post('*/api/v1/profile/sections', ({ request }) => {
        present = request.headers.has('X-XSRF-TOKEN');
        return HttpResponse.json({ id: 'sec-1', version: 0 });
      }),
    );

    await api.post('/profile/sections', { title: 'Experience' });

    // An empty header would be a claim; its absence is the truth, and the
    // server answers `403 CSRF_TOKEN_INVALID`, which the panel can explain.
    expect(present).toBe(false);
  });

  it('reads the cookie again for each request rather than caching it', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.post('*/api/v1/profile/sections', ({ request }) => {
        seen.push(request.headers.get('X-XSRF-TOKEN'));
        return HttpResponse.json({ id: 'sec-1', version: 0 });
      }),
    );

    setToken('first');
    await api.post('/profile/sections', { title: 'Experience' });
    setToken('second');
    await api.post('/profile/sections', { title: 'Education' });

    // Why `CSRF_TOKEN_INVALID` is not retried: the server may rotate the
    // token, and a client holding a cached copy would send the stale one
    // forever, turning one refusal into every refusal.
    expect(seen).toEqual(['first', 'second']);
  });

  it('picks its own cookie out of the jar', async () => {
    let seen: string | null = null;
    server.use(
      http.post('*/api/v1/profile/sections', ({ request }) => {
        seen = request.headers.get('X-XSRF-TOKEN');
        return HttpResponse.json({ id: 'sec-1', version: 0 });
      }),
    );

    document.cookie = 'NEXT_LOCALE=tr; path=/';
    setToken('the-right-one');
    document.cookie = 'other=XSRF-TOKEN; path=/';

    await api.post('/profile/sections', { title: 'Experience' });

    // A prefix match on the joined cookie string finds `other=XSRF-TOKEN`
    // too, and a suffix match finds nothing. Names are compared whole.
    expect(seen).toBe('the-right-one');
  });
});
