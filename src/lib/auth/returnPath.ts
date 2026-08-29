/**
 * Where to go after signing in, and the only thing that decides it.
 *
 * The server validates `next` before it redirects (§ 40.6.1), and this
 * validates it again on arrival — not out of distrust, but because the two
 * checks guard different things. The server's protects the redirect it
 * issues; this one protects the navigation *we* perform, from a `next` that
 * reached the landing page without passing through the server at all: a
 * hand-built `/auth/complete?next=…`, a bookmark, a link in an email.
 *
 * An open redirect is a link whose address bar genuinely starts with our
 * domain and which ends on somebody else's sign-in form. That is worth two
 * checks.
 */

import { locales } from '@/lib/i18n/locales';

/** What a `next` we cannot trust falls back to (§ 40.6.1 says the same). */
const HOME = '/';

/**
 * Only ever used as a yardstick: a candidate resolved against it must still
 * be on it. An origin no real deployment can hold, so an absolute URL cannot
 * match it by accident.
 */
const PROBE_ORIGIN = 'http://return-path.invalid';

/**
 * A leading locale segment is dropped, because the caller adds one.
 *
 * Our own links send an unprefixed path and let next-intl's router prefix it,
 * so the locale is decided in one place. A `next` that already carries one —
 * from a bookmark, or from someone copying a URL out of the address bar —
 * would otherwise be prefixed twice and land on `/tr/tr/profile`, a 404 at
 * the end of a successful sign-in.
 */
function stripLocalePrefix(pathname: string): string {
  const [, first, ...rest] = pathname.split('/');
  if (!first || !(locales as readonly string[]).includes(first)) return pathname;

  return `/${rest.join('/')}`;
}

/**
 * The path to navigate to, or `/`.
 *
 * Resolved against a probe origin rather than pattern-matched, because the
 * patterns are the part that gets this wrong: `//evil.example` is
 * protocol-relative and a "does it start with a slash" check waves it
 * through, and `/\evil.example` is the same trick again — browsers normalise
 * the backslash. `URL` normalises both the same way a browser does, which is
 * the behaviour the check has to agree with, and then the origin comparison
 * catches them.
 *
 * The leading-slash test in front of it is not redundant either: it is what
 * rejects a scheme (`javascript:`, `https://…`) before the parser has to have
 * an opinion about it.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) return HOME;

  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return HOME;
  }

  if (url.origin !== PROBE_ORIGIN) return HOME;

  const path = stripLocalePrefix(url.pathname);
  // The query and the hash ride along: `next` is a place in the app, and
  // `/generations/abc?tab=letter` is a different place from `/generations/abc`.
  const resolved = `${path}${url.search}${url.hash}`;

  return resolved.startsWith('/') ? resolved : HOME;
}
