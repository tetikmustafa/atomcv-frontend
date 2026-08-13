import { describe, expect, it } from 'vitest';
import { buildPatch } from '@/lib/api/buildPatch';

describe('buildPatch', () => {
  it('drops keys whose value is undefined', () => {
    expect(buildPatch({ importance: 0.9, alwaysInclude: undefined })).toEqual({
      importance: 0.9,
    });
  });

  it('keeps an explicit null, which merge-patch reads as "clear this field"', () => {
    expect(buildPatch({ endDate: null })).toEqual({ endDate: null });
  });

  it('keeps falsy values that are not undefined', () => {
    expect(buildPatch({ importance: 0, alwaysInclude: false, note: '' })).toEqual({
      importance: 0,
      alwaysInclude: false,
      note: '',
    });
  });

  /**
   * The case this helper exists for. An empty merge-patch is a request that
   * succeeds, changes nothing, and still flips the save indicator to "saved"
   * (Bölüm 37.3) — the editor telling the user their edit was stored when it
   * was not. Returning null forces the caller to skip the request instead.
   */
  it('returns null when every field was undefined', () => {
    expect(buildPatch({ importance: undefined, alwaysInclude: undefined })).toBeNull();
  });

  it('returns null for an empty object', () => {
    expect(buildPatch({})).toBeNull();
  });
});
