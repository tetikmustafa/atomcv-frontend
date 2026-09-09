import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';
import { formatErrorParams, MESSAGE_DEFAULTS, type IcuValue } from '@/lib/errors/errorParams';
import type { ErrorCode, KnownResolutionAction } from '@/types/domain';

/**
 * The `params` each code carries, with the types `spec/08b-api-contract.md` declares.
 *
 * This is test data, not a mirror of a backend type: it is the input every
 * message has to survive. The server refuses to publish an undeclared key
 * (`spec/08b-api-contract.md`), so formatting a message with exactly this set is the same
 * information the message will ever get — and formatting throws when a
 * message reaches for anything else, which is the typo this file exists to
 * catch.
 */
const PARAMS = {
  INSUFFICIENT_PROFILE: { completeness: 28, missing: ['atoms', 'sections'] },
  // `reason` joined the catalogue with `B-043` and the message branches on
  // it. The other two still travel, but they measure only two of the eight
  // reasons — which is why the sentence is chosen by `reason` first.
  UNPARSEABLE_JOB_DESCRIPTION: { reason: 'too_few_skills', confidence: 0.3, skillsFound: 2 },
  CONFLICTING_PREFERENCES: { pinnedPages: 2.3, maxPages: 1 },
  // A **token**, not a phrase. § 35.7.2 and § 35.7.3 publish the three
  // (`B-081`, `B-082`) and the message branches on them, because
  // `atom_controls` on screen is a machine name and "that needs an account"
  // is a sentence that names no button.
  FEATURE_REQUIRES_ACCOUNT: { feature: 'cover_letter' },
  QUOTA_EXCEEDED: { metric: 'generation', resetsAt: '2026-08-16T00:00:00Z' },
  ALL_PROVIDERS_UNAVAILABLE: { tried: ['anthropic', 'openai'] },
  COMPILATION_FAILED: { detail: 'Undefined control sequence.', rawSourceAvailable: true },
  PAGE_LIMIT_EXCEEDED: { actual: 2, limit: 1 },
  REWRITE_VALIDATION_FAILED: {
    atomId: '661a39b9-41b7-4ad8-a886-1054768029a6',
    issues: ['metric lost', 'technology added'],
  },
  // `issues` is a **closed** vocabulary of six (`B-063` confirmed it), so the
  // message names them — see the block at the bottom of this file. The values
  // here stay raw because this is the wire payload; `useErrorMessage` turns
  // them into words on the way through.
  COVER_LETTER_REJECTED: { issues: ['unsupported_claim', 'cliche'] },
  EMBEDDING_UNAVAILABLE: {},
  // 503. The kill switch of § 44.3: parameterless, because there is
  // nothing in the request to change.
  GENERATION_PAUSED: {},
  // The accepted extensions are the server's to publish, not the client's to
  // embed: a format added server-side must correct this sentence without
  // waiting for a frontend release (§ EK D.6).
  UNSUPPORTED_DOCUMENT: { accepted: ['pdf', 'docx', 'tex', 'txt', 'md'] },
  // The limit, never the size that was sent. Spring refuses an oversized
  // multipart before anything counts its bytes, so the client's own figure is
  // the only reliable one and it already has it.
  DOCUMENT_TOO_LARGE: { limitBytes: 10_485_760 },
  PDF_NOT_TEXT_BASED: {},
  PDF_ENCRYPTED: {},
  EXTRACTION_EMPTY: {},
  EXTRACTION_TIMEOUT: {},
  LANGUAGE_UNDETECTED: { detectedCandidates: ['tr', 'az'] },
  // From a background job, and the user's own screen already says the right
  // thing — the wording stays marked stale. Parameterless because what the
  // translation dropped was the person's own content (rule 4).
  TRANSLATION_FAILED: {},
  PROFILE_QUOTA_EXCEEDED: { limit: 3, resetsAt: '2026-08-16T00:00:00Z' },
  ANONYMOUS_SESSION_EXPIRED: {},
  ATOM_LIMIT_EXCEEDED: { limit: 60, current: 60 },
  NO_ANONYMOUS_PROFILE: {},
  PROFILE_ALREADY_EXISTS: {},
  GENERATION_ARTIFACT_EXPIRED: {},
  CSRF_TOKEN_INVALID: {},
  // A request carrying no session at all — neither an expired anonymous one
  // nor a feature out of reach, which is why it is its own code (§ EK D.6).
  AUTHENTICATION_REQUIRED: {},
  // One code, seven reasons, the shape `F-016` asked for. Covered branch by
  // branch below, exactly as `UNPARSEABLE_JOB_DESCRIPTION` is.
  OAUTH_FAILED: { reason: 'provider_unavailable' },
  // Parameterless on purpose: expired, spent, wrong and never-existed are one
  // answer, or a guesser learns which half of the guess was right (§ 40.4.1).
  MAGIC_LINK_INVALID: {},
  RATE_LIMITED: { resetsAt: '2026-08-16T00:00:00Z' },
  // Missing, expired, spent and forged are one answer too, and for a simpler
  // reason: the thing to do is the same in all four — reset the widget.
  CHALLENGE_FAILED: {},
  RESOURCE_NOT_FOUND: {},
  VERSION_CONFLICT: {},
  PRECONDITION_REQUIRED: {},
  VALIDATION_FAILED: { fields: ['headline', 'contact.email'] },
  // 405, 406 and 415. Parameterless, and none of them is an error a
  // correct client ever sees — they are in the catalogue so that a
  // protocol-level refusal still carries a `code` rather than an empty
  // body (handoff B-025).
  METHOD_NOT_ALLOWED: {},
  NOT_ACCEPTABLE: {},
  UNSUPPORTED_MEDIA_TYPE: {},
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
  // The two ways out of `409 PROFILE_ALREADY_EXISTS`, and there is no third:
  // merging means atom-level deduplication, which is Stage 4 work, so
  // offering it would name an action the server cannot perform (`B-060`).
  replace_profile: {},
  keep_existing_profile: {},
  review_pins: {},
  keep_top_pinned: { keep: 3 },
  sign_up: {},
  paste_full_posting: {},
  continue_as_general_cv: {},
  continue_anyway: {},
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

  /**
   * The same merge `useErrorMessage` performs, and it has to be here for the
   * same reason it is there: not every argument a message reads is a wire
   * param. `retryAfterMinutes` comes from a **header**, so `PARAMS` above —
   * which is a record of what the *body* declares — cannot honestly list it,
   * and a message that branches on it would render as its own key path.
   *
   * Rendering the way production renders is the point. The cost is that a
   * `reason` missing from `PARAMS` would be papered over by the default; the
   * per-reason blocks further down are what cover that.
   */
  const renderCode = (code: string, params: Record<string, unknown>) =>
    t(code, { ...MESSAGE_DEFAULTS, ...formatErrorParams(params, locale) });

  it.each(Object.entries(PARAMS))('formats %s with the params it declares', (code, params) => {
    const rendered = renderCode(code, params);

    expect(rendered.length).toBeGreaterThan(0);
    // A leftover brace means an argument the message asked for and the
    // catalogue does not declare — the server will never send it, so the
    // sentence would reach a user with `{maxPage}` still in it.
    expect(rendered).not.toMatch(/[{}]/);
    /*
      And the other way a message fails, which has no braces in it at all:
      next-intl renders a message as **its own key path** when an ICU `select`
      or `plural` argument is missing entirely. Measured, not assumed — and
      the brace check above sails straight past it, because `errors.CODE` is
      punctuation-free. This is the assertion that would have caught it.
    */
    expect(rendered).not.toBe(code);
    expect(rendered).not.toContain(`errors.${code}`);
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

  /**
   * `B-043`: several reasons behind one code, and the sentence is chosen by
   * `reason` rather than by `skillsFound`. Before this, every refusal read as
   * "no skills came out of it" — accidentally true for the preflight, which
   * sends zero because it analysed nothing, and simply wrong for the gate.
   *
   * Seven since `B-072`: `no_responsibilities` is no longer produced and left
   * the enum. The rule behind it was sound and wrong about the world — most
   * real postings are an unheaded list of qualifications, and Faz B now reads
   * the work out of whatever the text has, so the door stopped throwing away
   * postings it had understood.
   */
  /**
   * One code, four doors — a **closed** set since `B-087` (`AccountFeature`,
   * § D.6.1), where it used to be `feature: string` and a guess was
   * indistinguishable from the contract. The point of `params.feature` is
   * that the refusal names the control the reader just pressed rather than
   * putting up a general registration wall, so each token has to reach a
   * sentence of its own.
   *
   * `feedback` is the one no screen can reach — the verdict form is not drawn
   * without an account — and it is covered anyway: the vocabulary is the
   * server's, and a value it may send has to render whether or not today's UI
   * can produce it.
   */
  describe('the four features behind FEATURE_REQUIRES_ACCOUNT', () => {
    const FEATURES = ['atom_controls', 'alternatives', 'cover_letter', 'feedback'] as const;

    const render = (feature: string) => renderCode('FEATURE_REQUIRES_ACCOUNT', { feature });

    it.each(FEATURES)('says something of its own for %s', (feature) => {
      const rendered = render(feature);

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain('errors.');
      // The token itself must not reach the reader: it is a machine name.
      expect(rendered).not.toContain(feature);
    });

    it('gives each feature a different sentence', () => {
      expect(new Set(FEATURES.map(render)).size).toBe(FEATURES.length);
    });

    it('falls back rather than printing a key for a feature it has never seen', () => {
      // The vocabulary can grow — the server gates a feature the day it adds
      // one — and a client built before that must still say something true.
      const rendered = render('a_feature_from_the_future');

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain('errors.');
    });
  });

  describe('the seven reasons behind UNPARSEABLE_JOB_DESCRIPTION', () => {
    const REASONS = [
      'too_short',
      'too_long',
      'low_entropy',
      'not_job_like',
      'low_confidence',
      'too_few_skills',
      'suspicious_output',
    ] as const;

    const render = (reason: string) =>
      t(
        'UNPARSEABLE_JOB_DESCRIPTION',
        formatErrorParams({ reason, confidence: 0.42, skillsFound: 3 }, locale),
      );

    it.each(REASONS)('says something of its own for %s', (reason) => {
      const rendered = render(reason);

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain('errors.');
    });

    it('gives each reason a different sentence', () => {
      // Branches that render the same string would pass every check above
      // while telling the user nothing new.
      expect(new Set(REASONS.map(render)).size).toBe(REASONS.length);
    });

    /**
     * `F-016`, kept alive after `B-072` took its captured payload off the
     * wire: a posting can be read confidently, yield twenty skills, and still
     * be refused. Only the reason that is *about* the count may print it —
     * any other sentence that reads `skillsFound` contradicts itself out loud.
     */
    it.each(REASONS.filter((reason) => reason !== 'too_few_skills'))(
      'does not blame the count in the sentence for %s',
      (reason) => {
        const rendered = t(
          'UNPARSEABLE_JOB_DESCRIPTION',
          formatErrorParams({ reason, confidence: 0.92, skillsFound: 20 }, locale),
        );

        expect(rendered).not.toContain('20');
      },
    );

    it('falls back rather than printing a key for a reason it has never seen', () => {
      // The vocabulary is closed today. `other` is what keeps a client that
      // meets a server which grew an eighth reason from rendering its own key
      // — and, since `B-072`, what would catch a stored refusal still naming
      // a reason the server has stopped producing.
      const rendered = render('a_reason_from_the_future');

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain('errors.');
    });
  });

  /**
   * The second code built the same way (§ EK D.6, Adım 3.3). Same shape, same
   * failure mode, so the same checks — including the one that matters most
   * here, that the branches are not eight copies of one sentence.
   *
   * `declined` is the reason this is worth spelling out: the person changed
   * their mind at the provider, which is not a failure, and a catalogue that
   * renders it with the same words as `account_disabled` tells them something
   * false on the screen where they are least able to check it.
   */
  describe('the seven reasons behind OAUTH_FAILED', () => {
    const REASONS = [
      'state_invalid',
      'declined',
      'provider_disabled',
      'provider_unavailable',
      'email_missing',
      'email_unverified',
      'account_disabled',
    ] as const;

    const render = (reason: string) => t('OAUTH_FAILED', formatErrorParams({ reason }, locale));

    it.each(REASONS)('says something of its own for %s', (reason) => {
      const rendered = render(reason);

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain('errors.');
    });

    it('gives each reason a different sentence', () => {
      expect(new Set(REASONS.map(render)).size).toBe(REASONS.length);
    });

    it('falls back rather than printing a key for a reason it has never seen', () => {
      const rendered = render('a_reason_from_the_future');

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain('errors.');
    });

    /** Not a failure, and the copy must not read like one (`B-048`). */
    it('does not call the user’s own change of mind an error', () => {
      expect(render('declined').toLowerCase()).not.toMatch(/error|failed|hata|başarısız/);
    });
  });

  /**
   * `B-050` wants the wait built from `Retry-After` rather than from the
   * absolute `resetsAt` beside it, and the reason is a clock: a duration is
   * right on a machine whose time is wrong, an instant is not.
   *
   * Which makes the zero branch the load-bearing one. It is not "no wait" —
   * it is "no header", the case where the value cannot be derived at all, and
   * a message that rendered it as "try again in 0 minutes" would invite a
   * retry that is refused again.
   */
  describe('the wait inside RATE_LIMITED', () => {
    const render = (retryAfterMinutes: number) =>
      t('RATE_LIMITED', { ...MESSAGE_DEFAULTS, retryAfterMinutes });

    it.each([0, 1, 15, 60])('says something whole for %i minutes', (minutes) => {
      const rendered = render(minutes);

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain('errors.');
    });

    it('names no duration at all when there was no header to read', () => {
      expect(render(0)).not.toMatch(/\d/);
    });

    it('gives the singular its own wording rather than "1 minutes"', () => {
      expect(render(1)).not.toBe(render(15));
      expect(render(1)).not.toMatch(/\b1\b/);
    });

    it('counts in the plural branch', () => {
      expect(render(15)).toContain('15');
    });
  });

  /**
   * One code, two meanings, and the server cannot tell them apart (`B-053`).
   *
   * An anonymous allowance is counted **per address** (§ 44.1), so somebody
   * in the same office can have spent it. "You have used yours up" is then a
   * sentence that blames the reader for a stranger — which is why the client
   * supplies who is asking and the catalogue branches on it.
   */
  describe('who PROFILE_QUOTA_EXCEEDED is talking to', () => {
    const render = (caller: string) =>
      t('PROFILE_QUOTA_EXCEEDED', {
        ...MESSAGE_DEFAULTS,
        ...formatErrorParams(PARAMS.PROFILE_QUOTA_EXCEEDED, locale),
        caller,
      });

    it.each(['account', 'anonymous', 'unknown'])('says something whole to %s', (caller) => {
      const rendered = render(caller);

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain('errors.');
    });

    it('does not tell an anonymous reader it was their allowance', () => {
      expect(render('anonymous')).not.toBe(render('account'));
    });

    /**
     * The session is a request too, and it can still be in flight when this
     * error arrives. Neither of the two real sentences is safe to guess with,
     * so the third branch says only what is true either way.
     */
    it('claims nothing while it does not yet know', () => {
      expect(render('unknown')).not.toBe(render('account'));
      expect(render('unknown')).not.toBe(render('anonymous'));
    });
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
 * The quota day turns at **UTC** midnight (`F-007`) — 03:00 in Turkey — so the
 * server sends an absolute instant and the client is the only side that can
 * put it in the reader's own zone. Rule 9, on the one param type ICU cannot
 * take as a string.
 */
describe('when a quota renews', () => {
  const RESETS_AT = new Date(PARAMS.QUOTA_EXCEEDED.resetsAt);

  /** Computed here rather than written down: the assertion must not depend on
   *  which zone the test runner happens to be in, only on it being formatted. */
  const localTime = (locale: string) =>
    new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(RESETS_AT);

  it.each(CATALOGUES)('says the time in %s, in the reader’s own zone', (locale, messages) => {
    const t = createTranslator({ locale, messages, namespace: 'errors' });

    // `RATE_LIMITED` is **not** in this list, although it carries `resetsAt`
    // too. Its sentence is built from `Retry-After` instead (`B-050`), and
    // the difference is a clock: these two say when a daily allowance renews,
    // which is a calendar fact worth naming as an hour; that one says how long
    // to wait, and a duration stays right on a machine whose time is wrong.
    for (const code of ['QUOTA_EXCEEDED', 'PROFILE_QUOTA_EXCEEDED'] as const) {
      // Through the defaults, like production: `PROFILE_QUOTA_EXCEEDED` now
      // branches on `caller`, which is not a wire param (`B-053`).
      const rendered = t(code, { ...MESSAGE_DEFAULTS, ...formatErrorParams(PARAMS[code], locale) });

      expect(rendered).toContain(localTime(locale));
      expect(rendered).not.toContain('2026-08-16T00:00:00Z');
    }
  });

  /**
   * Why `formatErrorParams` has to convert it, and the failure is worse than
   * an ugly date: ICU's `time` argument needs a `Date`, and handed the ISO
   * string the server actually sends, next-intl does not print it and does not
   * throw — it gives back the bare key, exactly as it does for an array.
   *
   * So the cost of skipping the conversion is a user reading
   * `errors.QUOTA_EXCEEDED` on the screen meant to explain the quota, with
   * nothing logged and nothing red in a test that only checked the call
   * returned a string.
   */
  it('degrades to the bare key when the instant is passed unformatted', () => {
    const t = createTranslator({ locale: 'en', messages: en, namespace: 'errors' });
    const raw = PARAMS.QUOTA_EXCEEDED as unknown as Record<string, IcuValue>;

    expect(t('QUOTA_EXCEEDED', raw)).toBe('errors.QUOTA_EXCEEDED');
  });
});

/**
 * `spec/06-pipeline-d-g.md` § 23: the server already tried shrinking the content twice before
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

/**
 * `B-063`: `CoverLetterIssue` is a closed enum with exactly six values, so
 * they can be said in words. Until it was confirmed closed the message named
 * none of them, because `Intl.ListFormat` joins whatever it is handed and
 * `unsupported_claim and cliche` is not a sentence.
 *
 * The other `issues` in the catalogue — `REWRITE_VALIDATION_FAILED`'s — are
 * free text a validator wrote, which is why the vocabulary table is keyed by
 * **code** rather than by param name.
 */
describe.each(CATALOGUES)('the six reasons a letter is refused (%s)', (locale, messages) => {
  const ISSUES = [
    'unsupported_claim',
    'number_invented',
    'experience_overstated',
    'wrong_company',
    'length_out_of_range',
    'cliche',
  ] as const;

  const name = createTranslator({
    locale,
    messages,
    namespace: 'errorValues.COVER_LETTER_REJECTED',
  }) as unknown as LooseTranslator;

  it.each(ISSUES)('names %s', (issue) => {
    const rendered = name(issue);

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).not.toContain('errorValues');
    // The name, not the token dressed up as one.
    expect(rendered).not.toContain(issue);
  });

  it('gives each one a sentence of its own', () => {
    expect(new Set(ISSUES.map((issue) => name(issue))).size).toBe(ISSUES.length);
  });
});
