import { describe, expect, it } from 'vitest';
import {
  entryForm,
  sectionForm,
  toEntryCreate,
  validationKey,
  type EntryFormValues,
} from '@/lib/forms/profileSchemas';

const entry = (over: Partial<EntryFormValues> = {}): EntryFormValues => ({
  title: 'Backend Engineer',
  organization: '',
  location: '',
  startDate: '',
  endDate: '',
  ...over,
});

/**
 * The rule the server now enforces too — and this check still earns its place.
 *
 * `POST /profile/entries` with `startDate` 2022 and `endDate` 2019 used to
 * answer **201**, which is what `F-002` was about. It answers **400** with
 * `params.fields: ["endDate"]` since the backend closed it, re-verified
 * against the running API. Left in deliberately: saying so before the round
 * trip is better than after it, and the two agree on the same boundary —
 * `>=`, so one-day entries pass, and silence when there is no end date.
 */
describe('a date range that runs backwards', () => {
  it('is refused, and the message lands on the end date', () => {
    const result = entryForm.safeParse(entry({ startDate: '2022-01-01', endDate: '2019-01-01' }));

    expect(result.success).toBe(false);
    const issue = result.error?.issues[0];
    expect(issue?.path).toEqual(['endDate']);
    expect(issue?.message).toBe('endBeforeStart');
  });

  it('allows the two to be the same day, which is a real short job', () => {
    expect(
      entryForm.safeParse(entry({ startDate: '2022-01-01', endDate: '2022-01-01' })).success,
    ).toBe(true);
  });

  /**
   * Only comparable when both are there. An open-ended job is the normal case
   * and must not be reported as an error.
   */
  it('says nothing when there is no end date', () => {
    expect(entryForm.safeParse(entry({ startDate: '2022-01-01' })).success).toBe(true);
  });
});

describe('a date the API could not use', () => {
  it('is refused before it can be sent', () => {
    for (const bad of ['2022-13-01', '2022-02-31', '01/01/2022', '2022-1-1']) {
      const result = entryForm.safeParse(entry({ startDate: bad }));
      expect(result.success, bad).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('invalidDate');
    }
  });

  it('accepts a real leap day', () => {
    expect(entryForm.safeParse(entry({ startDate: '2024-02-29' })).success).toBe(true);
  });
});

describe('what the entry form sends', () => {
  /**
   * Blank optionals are left out rather than sent as `""`. An absent `endDate`
   * is what "still there" means on the wire; an empty string is a value, and
   * the heading would then have an end date it cannot format.
   */
  it('omits the fields left blank instead of sending empty strings', () => {
    const body = toEntryCreate('sec-1', entry({ organization: '  ', startDate: '2022-01-01' }));

    expect(body).toEqual({
      sectionId: 'sec-1',
      title: 'Backend Engineer',
      startDate: '2022-01-01',
    });
    expect(body).not.toHaveProperty('endDate');
    expect(body).not.toHaveProperty('organization');
  });

  it('trims what it does send', () => {
    const body = toEntryCreate('sec-1', entry({ title: '  Padded  ', organization: ' Acme ' }));

    expect(body.title).toBe('Padded');
    expect(body.organization).toBe('Acme');
  });
});

describe('a title', () => {
  it('is required, by both forms, with the same key', () => {
    expect(entryForm.safeParse(entry({ title: '   ' })).error?.issues[0]?.message).toBe(
      'titleRequired',
    );
    expect(sectionForm.safeParse({ kind: 'custom', title: '' }).error?.issues[0]?.message).toBe(
      'titleRequired',
    );
  });
});

/**
 * Rule 8, applied to validation. Zod attaches its own English default to any
 * failure that does not name a key, and rendering that raw would put an
 * untranslated internal string in front of a Turkish user.
 */
describe('a message with no key', () => {
  it('falls back to one the catalogue has', () => {
    expect(validationKey('titleRequired')).toBe('titleRequired');
    expect(validationKey('Invalid input')).toBe('invalid');
    expect(validationKey(undefined)).toBe('invalid');
  });
});
