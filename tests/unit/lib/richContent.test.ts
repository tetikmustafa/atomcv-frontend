import { describe, expect, it } from 'vitest';
import { plainText } from '@/lib/content/plainText';
import {
  createRun,
  hasMark,
  isKnownMark,
  parseRichContent,
  RichContentError,
  toContentPayload,
  type RichContent,
} from '@/lib/content/richContent';

const SAMPLE: RichContent = {
  v: 1,
  runs: [
    { t: 'Engineered ', m: [] },
    { t: 'ETL', m: ['technology'] },
    { t: ' pipelines processing ', m: [] },
    { t: '300K+ rows', m: ['metric'] },
  ],
};

describe('parseRichContent', () => {
  it('reads the documented shape', () => {
    const parsed = parseRichContent(SAMPLE);

    expect(parsed.v).toBe(1);
    expect(parsed.runs).toHaveLength(4);
    expect(hasMark(parsed.runs[1]!, 'technology')).toBe(true);
  });

  it('rejects content without a version rather than inventing one', () => {
    expect(() => parseRichContent({ runs: [] })).toThrow(RichContentError);
  });

  /**
   * EK D.2: an error message must not carry content. A malformed run is
   * identified by position, because the alternative puts a user's CV text
   * into a log line (Bölüm 48.2).
   */
  it('names the position of a broken run, never its text', () => {
    const attempt = () => parseRichContent({ v: 1, runs: [{ t: 'fine', m: [] }, { m: [] }] });

    expect(attempt).toThrow(RichContentError);
    expect(attempt).toThrow('Run 1');
    expect(() => attempt()).not.toThrow(/fine/);
  });
});

/**
 * The invariant the backend enforces with a 400 (D.9 · 1, D.9 · 18). Both
 * directions: a link with nothing to follow, and a target that will never
 * render and would be silently dropped on the next write.
 */
describe('the href invariant', () => {
  it('refuses a link run with no href', () => {
    expect(() => createRun('AtomCV', ['link'])).toThrow(RichContentError);
    expect(() => parseRichContent({ v: 1, runs: [{ t: 'AtomCV', m: ['link'] }] })).toThrow(
      RichContentError,
    );
  });

  it('refuses an href on a run that is not a link', () => {
    expect(() => createRun('AtomCV', ['emphasis'], 'https://example.com')).toThrow(
      RichContentError,
    );
    expect(() =>
      parseRichContent({
        v: 1,
        runs: [{ t: 'AtomCV', m: ['emphasis'], href: 'https://example.com' }],
      }),
    ).toThrow(RichContentError);
  });

  it('accepts a link run that carries its href', () => {
    const run = createRun('AtomCV', ['link'], 'https://example.com');
    expect(run.href).toBe('https://example.com');
  });

  it('catches an invalid run on the way out, not only on the way in', () => {
    // Bypasses createRun the way an editor assembling state by hand would.
    const smuggled = [{ t: 'AtomCV', m: ['link'] }] as never;
    expect(() => toContentPayload(smuggled)).toThrow(RichContentError);
  });
});

/**
 * Forward compatibility is symmetric. The backend keeps a mark it does not
 * recognise and plain-renders it; if this side dropped one, markup written by
 * a newer version would disappear the moment the user edited that sentence.
 */
describe('unknown marks', () => {
  const withUnknown = {
    v: 1,
    runs: [{ t: 'Quantum annealing', m: ['technology', 'from_a_future_version'] }],
  };

  it('survives a parse and serialise round trip', () => {
    const payload = toContentPayload(parseRichContent(withUnknown));

    expect(payload.runs[0]!.m).toEqual(['technology', 'from_a_future_version']);
  });

  it('is reported as unknown without being removed', () => {
    const parsed = parseRichContent(withUnknown);

    expect(isKnownMark('technology')).toBe(true);
    expect(isKnownMark('from_a_future_version')).toBe(false);
    expect(parsed.runs[0]!.m).toContain('from_a_future_version');
  });
});

describe('toContentPayload', () => {
  /** D.9 · 3: the server stamps the version; a client-sent one is refused. */
  it('drops the version', () => {
    const payload = toContentPayload(SAMPLE);

    expect(payload).not.toHaveProperty('v');
    expect(payload.runs).toHaveLength(4);
  });

  it('does not alias the caller’s mark arrays', () => {
    const payload = toContentPayload(SAMPLE);
    payload.runs[1]!.m.push('emphasis');

    expect(SAMPLE.runs[1]!.m).toEqual(['technology']);
  });
});

describe('plainText', () => {
  it('is the concatenation of run text, with no markup', () => {
    expect(plainText(SAMPLE)).toBe('Engineered ETL pipelines processing 300K+ rows');
  });

  /**
   * Why this matters: `content_hash` is the hash of exactly this string, so
   * re-marking a sentence leaves the hash — and the measured render costs —
   * untouched (EK D.2, D.9 · 5).
   */
  it('is unchanged by re-marking', () => {
    const remarked: RichContent = {
      v: 1,
      runs: SAMPLE.runs.map((run) => ({ ...run, m: run.t.trim() === 'ETL' ? ['emphasis'] : [] })),
    };

    expect(plainText(remarked)).toBe(plainText(SAMPLE));
  });
});
