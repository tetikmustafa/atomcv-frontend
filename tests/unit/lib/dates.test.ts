import { describe, expect, it } from 'vitest';
import { formatMonthYear } from '@/lib/i18n/dates';

/**
 * Rule 9, and the one bug it is actually protecting against.
 *
 * Wire dates are `YYYY-MM-DD` with no time and no zone. `new Date('2022-04-01')`
 * reads that as UTC midnight, and rendering it in any zone behind UTC lands on
 * the previous day — which for the first of a month is the previous *month*.
 * A job that started in April is then shown as starting in March, in a field
 * nobody re-reads because it looks plausible.
 */
describe('a wire date on screen', () => {
  it('names the month in the reader’s language', () => {
    expect(formatMonthYear('2022-04-01', 'en')).toBe('Apr 2022');
    // Not a translation of the English: `Intl` is the single source, which is
    // the whole point of the rule.
    expect(formatMonthYear('2022-04-01', 'tr')).toBe('Nis 2022');
  });

  /**
   * The regression this exists for. Run under a zone behind UTC, the naive
   * reading of the first of the month slips back a month.
   */
  it('stays in the month it was written, west of UTC', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';

    try {
      expect(formatMonthYear('2022-04-01', 'en')).toBe('Apr 2022');
      expect(formatMonthYear('2019-08-01', 'en')).toBe('Aug 2019');
    } finally {
      process.env.TZ = original;
    }
  });

  /**
   * A date the formatter cannot read is left out of the heading rather than
   * guessed at. An absent range is a gap; a wrong one is a lie about the
   * user's own history.
   */
  it('gives nothing back rather than inventing a date', () => {
    expect(formatMonthYear('', 'en')).toBeUndefined();
    expect(formatMonthYear('April 2022', 'en')).toBeUndefined();
    expect(formatMonthYear('2022-04', 'en')).toBeUndefined();
    expect(formatMonthYear('2022-13-01', 'en')).toBeUndefined();
    // `Date.UTC` rolls these over into a real, wrong date rather than
    // rejecting them, which is why the check is a round-trip.
    expect(formatMonthYear('2022-02-31', 'en')).toBeUndefined();
    expect(formatMonthYear('2023-02-29', 'en')).toBeUndefined();
    // A real leap day still passes.
    expect(formatMonthYear('2024-02-29', 'en')).toBe('Feb 2024');
  });
});
