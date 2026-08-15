import { describe, expect, it } from 'vitest';
import { toIfMatch, VersionError } from '@/lib/api/etag';

/**
 * The header is quoted and Spring compares it literally: `If-Match: 2` on a
 * resource at version 2 answers 412, verified against the running backend.
 * That is indistinguishable from a real conflict at the call site, so these
 * tests are the only thing standing between a formatting slip and a "someone
 * else edited this" dialog shown to someone editing alone.
 */
describe('toIfMatch', () => {
  it('quotes a bare version from a collection item', () => {
    expect(toIfMatch(0)).toBe('"0"');
    expect(toIfMatch(7)).toBe('"7"');
  });

  it('passes a quoted ETag through unchanged', () => {
    expect(toIfMatch('"7"')).toBe('"7"');
  });

  it('quotes a version that arrived as a numeric string', () => {
    expect(toIfMatch('7')).toBe('"7"');
  });

  /**
   * A missing version is the one case with a non-obvious cause: the profile
   * head's version exists only as a response header, so a proxy that strips
   * ETag breaks writes while leaving reads looking healthy.
   */
  it('refuses an absent version and says where it should have come from', () => {
    expect(() => toIfMatch(undefined)).toThrow(VersionError);
    expect(() => toIfMatch(undefined)).toThrow(/ETag/);
  });

  /** Weak validators never match under If-Match's strong comparison. */
  it('refuses a weak validator instead of guaranteeing a 412', () => {
    expect(() => toIfMatch('W/"7"')).toThrow(VersionError);
  });

  it('refuses values that are not versions at all', () => {
    expect(() => toIfMatch(-1)).toThrow(VersionError);
    expect(() => toIfMatch(1.5)).toThrow(VersionError);
    expect(() => toIfMatch('')).toThrow(VersionError);
    expect(() => toIfMatch('latest')).toThrow(VersionError);
  });
});
