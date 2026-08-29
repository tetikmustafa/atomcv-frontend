import { describe, expect, it } from 'vitest';
import { safeReturnPath } from '@/lib/auth/returnPath';

describe('the path a sign-in returns to', () => {
  it('keeps an ordinary in-app path, with its query and hash', () => {
    expect(safeReturnPath('/profile')).toBe('/profile');
    expect(safeReturnPath('/generations/abc?tab=letter')).toBe('/generations/abc?tab=letter');
    expect(safeReturnPath('/profile#skills')).toBe('/profile#skills');
  });

  it('falls back to the home page when there is nothing to return to', () => {
    expect(safeReturnPath(undefined)).toBe('/');
    expect(safeReturnPath(null)).toBe('/');
    expect(safeReturnPath('')).toBe('/');
  });

  /**
   * The whole reason this function exists. An open redirect is a link whose
   * address bar genuinely starts with our domain and which ends on somebody
   * else's sign-in form — and each of these gets past a check that only asks
   * whether the string starts with a slash.
   */
  it.each([
    ['a protocol-relative URL', '//evil.example/login'],
    ['the same trick with a backslash, which browsers normalise', '/\\evil.example/login'],
    ['a mixed pair', '/\\/evil.example'],
    ['an absolute URL', 'https://evil.example/login'],
    ['a scheme that is not navigation at all', 'javascript:alert(1)'],
    ['a bare relative path, which is ambiguous about where it resolves', 'profile'],
  ])('refuses %s', (_name, candidate) => {
    expect(safeReturnPath(candidate)).toBe('/');
  });

  /**
   * Our own links send an unprefixed path and let next-intl prefix it. One
   * that arrives already prefixed — pasted out of an address bar, or
   * bookmarked — would otherwise be prefixed twice and 404 at the end of a
   * successful sign-in.
   */
  it('drops a locale prefix the caller is about to add again', () => {
    expect(safeReturnPath('/tr/profile')).toBe('/profile');
    expect(safeReturnPath('/en/generations/abc?tab=letter')).toBe('/generations/abc?tab=letter');
    expect(safeReturnPath('/en')).toBe('/');
  });

  it('leaves a path that merely looks like a locale alone', () => {
    // `de` is not one of ours, so this is a route, not a prefix.
    expect(safeReturnPath('/de/profile')).toBe('/de/profile');
  });
});
