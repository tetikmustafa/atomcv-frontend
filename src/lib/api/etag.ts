/**
 * `If-Match` values.
 *
 * A version reaches the client two ways, and they are not the same shape:
 * the `ETag` header carries it quoted (`"7"`), while a collection response
 * carries a bare `version: 7` on each item. Both have to become the same
 * header, and getting it wrong is unusually expensive.
 *
 * Verified against the running backend: `If-Match: 2` on a resource at
 * version 2 answers **412**, not 200 — Spring compares the header literally
 * and an unquoted value matches nothing. A 412 is exactly what a genuine
 * conflict looks like, so the mistake surfaces as a "someone else edited
 * this" dialog shown to a user editing alone, and nothing in the response
 * distinguishes the two.
 *
 * So no call site builds this header. It is produced here, or not at all.
 */

/** A bare version from a collection item, or a quoted `ETag` from a header. */
export type Version = number | string;

const QUOTED = /^"[^"]*"$/;
const BARE_NUMBER = /^\d+$/;
const WEAKENED_NUMBER = /^W\/("\d+")$/;

export class VersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionError';
  }
}

/**
 * Formats a version as an `If-Match` header value.
 *
 * Throws rather than guessing. Every rejection here is a programming error
 * whose alternative is a silent 412 — the one failure the caller cannot
 * diagnose from the response.
 */
export function toIfMatch(version: Version | undefined): string {
  if (version === undefined) {
    throw new VersionError(
      'A write needs the version it is based on, and none was given. ' +
        'For the profile head that version comes only from the ETag response ' +
        'header — if reads look fine but this throws, check that nothing ' +
        'between the browser and Spring is stripping ETag.',
    );
  }

  if (typeof version === 'number') {
    if (!Number.isInteger(version) || version < 0) {
      throw new VersionError(`A version must be a non-negative integer, got ${version}`);
    }
    return `"${version}"`;
  }

  if (QUOTED.test(version)) return version;
  if (BARE_NUMBER.test(version)) return `"${version}"`;

  /*
    A weakened version number is the server's own tag after a proxy touched
    it, and it goes back strong. nginx weakens every ETag on a response it
    gzips (`"2"` arrives as `W/"2"`), and production gzips JSON — so this
    used to throw on the profile head in production and nowhere else: the
    settings and the head stopped saving without sending a request, and dev,
    with no nginx in front, never saw it (measured 2026-10-24 behind the
    deployment's own nginx.conf). The number is the row's version either way,
    and the backend accepts both spellings for the same reason.

    Anything else weak is still refused: If-Match compares strongly (RFC 9110
    §13.1.1), and a weak tag that is not one of ours would only buy a 412.
  */
  const weakened = WEAKENED_NUMBER.exec(version);
  if (weakened) return weakened[1]!;
  if (version.startsWith('W/')) {
    throw new VersionError(
      `If-Match requires a strong validator; ${version} is weak and would never match`,
    );
  }

  throw new VersionError(`Not a usable version: ${JSON.stringify(version)}`);
}
