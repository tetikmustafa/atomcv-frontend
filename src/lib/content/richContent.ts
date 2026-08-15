/**
 * The run/mark content model (Bölüm 12.3, 14.1; invariants in EK D.2 and D.9).
 *
 * Atom text is a list of runs, not a string. Marks are semantic rather than
 * stylistic: a template decides what `technology` looks like, and the rewrite
 * validator reads `metric` runs directly to check the numbers survived.
 *
 * Every editor path goes through this module. The rules below are enforced
 * here and nowhere else, so they cannot drift component by component.
 *
 * The shapes come from the generated schema rather than being restated, so a
 * change to `Content` or `Run` on the wire lands here as a typecheck failure.
 * What is added on top is the one narrowing the schema cannot express: a
 * parsed run always carries its mark array.
 */

import type { components } from '@/types/api';

/** The vocabulary today. Deliberately not exhaustive — see `Mark`. */
export const KNOWN_MARKS = ['technology', 'metric', 'emphasis', 'link', 'organization'] as const;

export type KnownMark = (typeof KNOWN_MARKS)[number];

/**
 * A mark the current version understands, or one it does not.
 *
 * The list is open on both ends. The backend reads, keeps and plain-renders a
 * mark it does not recognise, and this side has to do the same: forward
 * compatibility only works if both honour it. Narrowing this to `KnownMark`
 * would delete a newer version's markup the moment a user edits that sentence
 * — the silent loss of work P8 exists to prevent.
 */
export type Mark = KnownMark | (string & {});

type WireRun = components['schemas']['Run'];
type WireContent = components['schemas']['Content'];

/**
 * A run as this side holds it.
 *
 * `m` is optional on the wire and required here: the schema permits a writer
 * to leave it out, and `parseRichContent` supplies `[]` when one does, so
 * everything downstream is spared an `undefined` check (D.9 · 4).
 */
export type Run = Omit<WireRun, 'm'> & { m: Mark[] };

/**
 * `v` stays optional, exactly as the schema has it. The server owns the
 * value — read it, never invent one — and the client has nothing to do with
 * it beyond dropping it before a write.
 */
export type RichContent = Omit<WireContent, 'runs'> & { runs: Run[] };

/** What a write sends: runs only, because `v` is the server's (D.9 · 3). */
export type RichContentPayload = Omit<WireContent, 'v' | 'runs'> & { runs: Run[] };

/**
 * Malformed content.
 *
 * The message names the position and never the text. Content must not reach a
 * log through an error string any more than through a logger argument
 * (Bölüm 48.2, EK D.2).
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
  // and silently lost — which is worse than being refused, because nobody
  // finds out. The backend rejects either with a 400 (D.9 · 18).
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
  // Absent means unmarked. The schema makes `m` optional and the server has
  // always sent `[]`, so this branch exists for the day it economises — which
  // would otherwise break every atom rather than one run.
  if (candidate.m !== undefined && !Array.isArray(candidate.m)) {
    throw new RichContentError(`${where} has a mark field that is not an array`);
  }
  if (Array.isArray(candidate.m) && candidate.m.some((mark) => typeof mark !== 'string')) {
    throw new RichContentError(`${where} has a non-string mark`);
  }
  if (candidate.href !== undefined && typeof candidate.href !== 'string') {
    throw new RichContentError(`${where} has a non-string href`);
  }

  // Marks are copied through untouched. Filtering to the known vocabulary here
  // is the exact bug this model is designed to avoid.
  const marks = [...((candidate.m ?? []) as Mark[])];
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
 * saving the result would corrupt the row on the next write — P4, and the
 * same stance the backend takes when it meets a version stamp from the
 * future (EK D.2).
 */
export function parseRichContent(value: unknown): RichContent {
  if (typeof value !== 'object' || value === null) {
    throw new RichContentError('Content is not an object');
  }

  const candidate = value as Record<string, unknown>;

  // `v` is optional on the wire and opaque here, so its absence is not an
  // error — but a `v` that is not a number means the field has been
  // repurposed, and guessing at that is how a client corrupts a row.
  if (candidate.v !== undefined && typeof candidate.v !== 'number') {
    throw new RichContentError('Content has a version that is not a number');
  }
  if (!Array.isArray(candidate.runs)) {
    throw new RichContentError('Content has no runs array');
  }

  const runs = candidate.runs.map(parseRun);
  return candidate.v === undefined ? { runs } : { v: candidate.v, runs };
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
