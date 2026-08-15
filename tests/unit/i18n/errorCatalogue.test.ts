import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';
import { formatErrorParams, type IcuValue } from '@/lib/errors/errorParams';
import type { ErrorCode, KnownResolutionAction } from '@/types/domain';

/**
 * The `params` each code carries, with the types EK D.6.1 declares.
 *
 * This is test data, not a mirror of a backend type: it is the input every
 * message has to survive. The server refuses to publish an undeclared key
 * (D.9 · 11), so formatting a message with exactly this set is the same
 * information the message will ever get — and formatting throws when a
 * message reaches for anything else, which is the typo this file exists to
 * catch.
 */
const PARAMS = {
  INSUFFICIENT_PROFILE: { completeness: 28, missing: ['atoms', 'sections'] },
  UNPARSEABLE_JOB_DESCRIPTION: { confidence: 0.3, skillsFound: 2 },
  CONFLICTING_PREFERENCES: { pinnedPages: 2.3, maxPages: 1 },
  FEATURE_REQUIRES_ACCOUNT: { feature: 'Cover letters' },
  QUOTA_EXCEEDED: { metric: 'generation', resetsAt: '2026-08-16T00:00:00Z' },
  ALL_PROVIDERS_UNAVAILABLE: { tried: ['anthropic', 'openai'] },
  COMPILATION_FAILED: { detail: 'Undefined control sequence.', rawSourceAvailable: true },
  PAGE_LIMIT_EXCEEDED: { actual: 2, limit: 1 },
  REWRITE_VALIDATION_FAILED: {
    atomId: '661a39b9-41b7-4ad8-a886-1054768029a6',
    issues: ['metric lost', 'technology added'],
  },
  EMBEDDING_UNAVAILABLE: {},
  PDF_NOT_TEXT_BASED: {},
  PDF_ENCRYPTED: {},
  EXTRACTION_EMPTY: {},
  EXTRACTION_TIMEOUT: {},
  LANGUAGE_UNDETECTED: { detectedCandidates: ['tr', 'az'] },
  PROFILE_QUOTA_EXCEEDED: { limit: 3, resetsAt: '2026-08-16T00:00:00Z' },
  ANONYMOUS_SESSION_EXPIRED: {},
  ATOM_LIMIT_EXCEEDED: { limit: 60, current: 60 },
  NO_ANONYMOUS_PROFILE: {},
  PROFILE_ALREADY_EXISTS: {},
  GENERATION_ARTIFACT_EXPIRED: {},
  CSRF_TOKEN_INVALID: {},
  RESOURCE_NOT_FOUND: {},
  VERSION_CONFLICT: {},
  PRECONDITION_REQUIRED: {},
  VALIDATION_FAILED: { fields: ['headline', 'contact.email'] },
  INTERNAL_ERROR: {},
} satisfies Record<ErrorCode, Record<string, unknown>>;

/**
 * Compile-time exhaustiveness. A code added to the schema and picked up by
 * `gen:api` becomes a type error here rather than a message nobody wrote —
 * which would otherwise surface as an untranslated key in front of a user, in
 * the one screen that is already telling them something went wrong.
 */
type Uncovered = Exclude<ErrorCode, keyof typeof PARAMS>;
const _everyCodeIsCovered: Uncovered extends never ? true : Uncovered = true;
void _everyCodeIsCovered;

const RESOLUTION_PARAMS = {
  increase_page_limit: { maxPages: 3 },
  review_pins: {},
  keep_top_pinned: { keep: 3 },
  sign_up: {},
  paste_full_posting: {},
  continue_as_general_cv: {},
  switch_to_manual_form: {},
  retry: {},
  complete_profile: {},
} satisfies Record<KnownResolutionAction, Record<string, unknown>>;

type UncoveredAction = Exclude<KnownResolutionAction, keyof typeof RESOLUTION_PARAMS>;
const _everyActionIsCovered: UncoveredAction extends never ? true : UncoveredAction = true;
void _everyActionIsCovered;

/** Same reason as in `useErrorMessage`: the key here is data, not a literal. */
type LooseTranslator = (key: string, values?: Record<string, IcuValue>) => string;

const CATALOGUES = [
  ['en', en],
  ['tr', tr],
] as const;

describe.each(CATALOGUES)('the %s error catalogue', (locale, messages) => {
  const t = createTranslator({
    locale,
    messages,
    namespace: 'errors',
  }) as unknown as LooseTranslator;
  const resolution = createTranslator({
    locale,
    messages,
    namespace: 'resolutions',
  }) as unknown as LooseTranslator;

  it.each(Object.entries(PARAMS))('formats %s with the params it declares', (code, params) => {
    const rendered = t(code, formatErrorParams(params, locale));

    expect(rendered.length).toBeGreaterThan(0);
    // A leftover brace means an argument the message asked for and the
    // catalogue does not declare — the server will never send it, so the
    // sentence would reach a user with `{maxPage}` still in it.
    expect(rendered).not.toMatch(/[{}]/);
  });

  it.each(Object.entries(RESOLUTION_PARAMS))('labels the %s action', (action, params) => {
    const rendered = resolution(action, formatErrorParams(params, locale));

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).not.toMatch(/[{}]/);
  });

  /** `toApiError` synthesises this for a body it could not read at all. */
  it('has a message for the synthetic fallback code', () => {
    expect(t('UNEXPECTED_ERROR')).not.toMatch(/[{}]/);
  });
});

describe('the numbers inside those sentences', () => {
  /**
   * `completeness` arrives as 28, not 0.28. ICU's percent style multiplies by
   * 100, so the obvious `{completeness, number, percent}` renders "2,800%" —
   * a plausible-looking sentence with a wrong number in it, which no type
   * checks. The skeleton scales it back.
   */
  it('renders completeness as a percentage of the right size', () => {
    const t = createTranslator({ locale: 'en', messages: en, namespace: 'errors' });
    const params = formatErrorParams(PARAMS.INSUFFICIENT_PROFILE, 'en');

    expect(t('INSUFFICIENT_PROFILE', params)).toContain('28%');
  });

  /** And the sign goes where the language puts it, not where English does. */
  it('puts the percent sign where Turkish puts it', () => {
    const t = createTranslator({ locale: 'tr', messages: tr, namespace: 'errors' });
    const params = formatErrorParams(PARAMS.INSUFFICIENT_PROFILE, 'tr');

    expect(t('INSUFFICIENT_PROFILE', params)).toContain('%28');
  });

  /**
   * Why `formatErrorParams` is not optional.
   *
   * Handed a raw array, next-intl does not throw — it gives back the key.
   * So the failure mode of skipping it is a user reading
   * `errors.INSUFFICIENT_PROFILE` on the screen that was supposed to explain
   * what went wrong, with nothing logged and nothing red in a test that only
   * checked the call did not blow up.
   */
  it('degrades to the bare key when an array is passed unformatted', () => {
    const t = createTranslator({ locale: 'en', messages: en, namespace: 'errors' });

    // Deliberately passing what the type forbids: this is the mistake being
    // documented, and TypeScript alone does not prevent it — the params
    // arrive as `unknown` from a JSON body at runtime.
    const raw = PARAMS.INSUFFICIENT_PROFILE as unknown as Record<string, IcuValue>;

    expect(t('INSUFFICIENT_PROFILE', raw)).toBe('errors.INSUFFICIENT_PROFILE');
  });

  /**
   * Rule 9, applied to the type ICU cannot format. An array interpolated raw
   * reads `atoms,sections` in every language at once.
   */
  it('reads a list as a sentence, in the reader’s language', () => {
    const english = createTranslator({ locale: 'en', messages: en, namespace: 'errors' });
    const turkish = createTranslator({ locale: 'tr', messages: tr, namespace: 'errors' });
    const params = PARAMS.INSUFFICIENT_PROFILE;

    expect(english('INSUFFICIENT_PROFILE', formatErrorParams(params, 'en'))).toContain(
      'atoms and sections',
    );
    expect(turkish('INSUFFICIENT_PROFILE', formatErrorParams(params, 'tr'))).toContain(
      'atoms ve sections',
    );
  });
});

/**
 * D.9 · 21: the server already tried shrinking the content twice before
 * returning this, so "try again" is guaranteed to fail again. The resolutions
 * are the server's to send, but the *message* is ours, and it should not
 * suggest the one thing that cannot work.
 */
describe('PAGE_LIMIT_EXCEEDED', () => {
  it.each(CATALOGUES)('does not invite a retry in %s', (locale, messages) => {
    const t = createTranslator({ locale, messages, namespace: 'errors' });
    const rendered = t('PAGE_LIMIT_EXCEEDED', PARAMS.PAGE_LIMIT_EXCEEDED).toLowerCase();

    expect(rendered).not.toMatch(/try again|tekrar dene|yeniden dene/);
  });
});
