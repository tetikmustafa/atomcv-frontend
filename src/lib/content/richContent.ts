/**
 * The run/mark content model (BÃ¶lÃ¼m 12.3, 14.1; invariants in EK D.2 and D.9).
 *
 * Atom text is a list of runs, not a string. Marks are semantic rather than
 * stylistic: a template decides what `technology` looks like, and the rewrite
 * validator reads `metric` runs directly to check the numbers survived.
 *
 * Every editor path goes through this module. The rules below are enforced
 * here and nowhere else, so they cannot drift component by component.
 */

/** The vocabulary today. Deliberately not exhaustive â€” see `Mark`. */
export const KNOWN_MARKS = ['technology', 'metric', 'emphasis', 'link', 'organization'] as const;

export type KnownMark = (typeof KNOWN_MARKS)[number];

/**
 * A mark the current version understands, or one it does not.
 *
 * The list is open on both ends. The backend reads, keeps and plain-renders a
 * mark it does not recognise, and this side has to do the same: forward
 * compatibility only works if both honour it. Narrowing this to `KnownMark`
 * would delete a newer version's markup the moment a user edits that sentence
 * â€” the silent loss of work P8 exists to prevent.
 */
export type Mark = KnownMark | (string & {});

export type Run = {
  /** Text content. */
  t: string;
  /** Always an array; an unmarked run carries `[]` rather than `undefined`. */
  m: Mark[];
  /** Only ever present on a `link` run, where it is required. */
  href?: string;
};

export type RichContent = {
  /** The server owns this. Read it, never invent it. */
  v: number;
  runs: Run[];
};

/** What a write sends: runs only, because `v` is the server's (D.9 Â· 3). */
export type RichContentPayload = { runs: Run[] };

/**
 * Malformed content.
 *
 * The message names the position and never the text. Content must not reach a
 * log through an error string any more than through a logger argument
 * (BÃ¶lÃ¼m 48.2, EK D.2).
 */
export class RichContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RichContentError';
  }
}

export function isKnownMark(mark: Mark): mark is KnownMark {
  return (KNOWN_MARKS as readonly string[]).includes(mark);
}

export function hasMark(run: Run, mark: Mark): boolean {
  return run.m.includes(mark);
}

function assertHrefInvariant(run: { m: Mark[]; href?: string }, where: string) {
  const isLink = run.m.includes('link');

  // Both directions matter. A `link` without a target renders as nothing a
  // user can follow; an `href` on a non-link run is stored, never rendered,
  // and silently lost â€” which is worse than being refused, because nobody
  // finds out. The backend rejects either with a 400 (D.9 Â· 18).
  if (isLink && !run.href) {
    throw new RichContentError(`${where} has the link mark but no href`);
  }
  if (!isLink && run.href !== undefined) {
    throw new RichContentError(`${where} has an href but not the link mark`);
  }
}

/**
 * Builds a run, enforcing the href invariant at construction so an editor
 * cannot assemble invalid content in the first place.
 */
export function createRun(text: string, marks: Mark[] = [], href?: string): Run {
  const run: Run =
    href === undefined ? { t: text, m: [...marks] } : { t: text, m: [...marks], href };
  assertHrefInvariant(run, 'Run');
  return run;
}

function parseRun(value: unknown, index: number): Run {
  const where = `Run ${index}`;

  if (typeof value !== 'object' || value === null) {
    throw new RichContentError(`${where} is not an object`);
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.t !== 'string') {
    throw new RichContentError(`${where} has no text`);
  }
  if (!Array.isArray(candidate.m)) {
    throw new RichContentError(`${where} has no mark array`);
  }
  if (candidate.m.some((mark) => typeof mark !== 'string')) {
    throw new RichContentError(`${where} has a non-string mark`);
  }
  if (candidate.href !== undefined && typeof candidate.href !== 'string') {
    throw new RichContentError(`${where} has a non-string href`);
  }

  // Marks are copied through untouched. Filtering to the known vocabulary here
  // is the exact bug this model is designed to avoid.
  const marks = [...(candidate.m as Mark[])];
  const run: Run =
    candidate.href === undefined
      ? { t: candidate.t, m: marks }
      : { t: candidate.t, m: marks, href: candidate.href as string };

  assertHrefInvariant(run, where);
  return run;
}

/**
 * Parses content that came from the server.
 *
 * Throws rather than repairing. Dropping a field we do not understand and
 * saving the result would corrupt the row on the next write â€” P4, and the
 * same stance the backend takes when it meets a version stamp from the
 * future (EK D.2).
 */
export function parseRichContent(value: unknown): RichContent {
  if (typeof value !== 'object' || value === null) {
    throw new RichContentError('Content is not an object');
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.v !== 'number') {
    throw new RichContentError('Content has no version');
  }
  if (!Array.isArray(candidate.runs)) {
    throw new RichContentError('Content has no runs array');
  }

  return {
    v: candidate.v,
    runs: candidate.runs.map(parseRun),
  };
}

/**
 * Prepares content for a write. Drops `v`: the server stamps the version, and
 * sending a stamp it did not issue is refused rather than guessed at.
 */
export function toContentPayload(content: RichContent | Run[]): RichContentPayload {
  const runs = Array.isArray(content) ? content : content.runs;
  runs.forEach((run, index) => assertHrefInvariant(run, `Run ${index}`));
  return { runs: runs.map((run) => ({ ...run, m: [...run.m] })) };
}
