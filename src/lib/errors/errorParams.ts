/**
 * Prepares an error's `params` for ICU interpolation.
 *
 * Numbers and strings go straight through — ICU formats them itself, which is
 * the whole reason the catalogue publishes types (`{pinnedPages, number}`
 * formats, `{pinnedPages}` merely substitutes).
 *
 * Timestamps do not either. Two codes carry one — `QUOTA_EXCEEDED` and
 * `PROFILE_QUOTA_EXCEEDED` both send `resetsAt` — and it arrives as an ISO
 * string, which ICU's `date`/`time` arguments cannot format: they need a
 * `Date`. Left as a string it would be substituted raw, so the sentence would
 * read "renews at 2026-08-22T00:00:00Z". Rule 9 again, and the reason the
 * server sends an absolute instant rather than an hour: the quota day turns at
 * **UTC** midnight (`F-007`), which is 03:00 in Turkey, and only the client
 * can put that in the reader's own zone.
 *
 * Lists do not. Five codes carry a `string[]` — `missing`, `tried`, `issues`,
 * `detectedCandidates`, `fields` — and ICU has no list argument, so an array
 * dropped into a message stringifies as `a,b,c`: no spaces, no conjunction,
 * and identical in every language. `Intl.ListFormat` is rule 9 applied to the
 * one type ICU cannot handle.
 */

/**
 * A list read out to a person, so "and" rather than "or": every array in the
 * catalogue is a set of things that are all true at once — the parts that are
 * all missing, the providers that were all tried.
 */
function formatList(values: readonly unknown[], locale: string): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
    values.map(String),
  );
}

/** What ICU can interpolate. Numbers and dates stay typed so it can format them. */
export type IcuValue = string | number | Date;

/**
 * Arguments every message is given, whether or not the server sent them.
 *
 * Measured, because the two absences behave nothing alike: an **unknown**
 * value falls to a `select`'s `other` branch, while a **missing** argument
 * makes next-intl render the message as its own key path —
 * `errors.OAUTH_FAILED` in front of the user, which is the failure this
 * exists to prevent. A `plural` fails the same way.
 *
 * - `reason` discriminates two codes with branch-per-reason messages
 *   (`B-043`). Today's server always sends it; this is what keeps a client
 *   that meets an older one, or a code that grows a branch later, from
 *   printing a key.
 * - `retryAfterMinutes` is **not a wire param at all** — it is derived from
 *   the `Retry-After` header, which the SSE transport has no way to carry.
 *   Zero is the "we were not told" branch, and it can only mean that: a real
 *   header rounds up to at least one minute.
 * - `caller` is not on the wire either, and cannot be: one code means two
 *   different things depending on who is asking. An anonymous allowance is
 *   counted **per address** (§ 44.1), so "you have used yours up" is a
 *   sentence that blames the reader for a stranger in the same office
 *   (`B-053`). The server does not know which sentence to write; the client
 *   does, from the session it already holds.
 *
 * Harmless where they are not used: ICU ignores an argument no branch reads.
 * Merged **under** the real values, never over them.
 */
export const MESSAGE_DEFAULTS: Record<string, IcuValue> = {
  reason: 'unknown',
  retryAfterMinutes: 0,
  caller: 'unknown',
};

/**
 * The `Retry-After` delay, in whole minutes, rounded up.
 *
 * Rounded **up** so the sentence never invites a retry that will be refused
 * again, and floored at one so a sub-minute delay does not collide with the
 * "we were not told" branch above.
 */
export function toRetryMinutes(seconds: number | undefined): number | undefined {
  if (seconds === undefined) return undefined;

  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Params whose values are a **closed vocabulary** rather than free text.
 *
 * `Intl.ListFormat` joins whatever it is given, so an array of machine tokens
 * reaches the reader as "unsupported_claim and cliche". Naming them needs the
 * catalogue, which means it cannot happen here — but *which* params are
 * nameable is contract knowledge and belongs beside the other param rules.
 *
 * **Keyed by code, not by param name, and that is the whole reason it is a
 * table.** Two codes carry `issues` and they mean different things:
 * `COVER_LETTER_REJECTED`'s six are an enum the server guards
 * (`CoverLetterIssue`, `B-063`), while `REWRITE_VALIDATION_FAILED`'s are
 * sentences a validator wrote. Translating the second would put a lookup
 * miss where a description used to be.
 *
 * The catalogue key is derived rather than configured: `errorValues.{code}.{value}`.
 */
export const VOCABULARIES: Record<string, readonly string[]> = {
  COVER_LETTER_REJECTED: ['issues'],
};

/**
 * Replaces the tokens of a closed vocabulary with their names.
 *
 * An unrecognised value is left **as it is** rather than dropped. The
 * vocabulary is closed and the server guards it with an enum and a spec test,
 * so a seventh value can only arrive with a document change — and on that day
 * a raw `some_new_reason` on screen is ugly, while silently shortening the
 * list would tell the reader their draft failed for fewer reasons than it did.
 */
export function nameVocabularies(
  code: string,
  params: Record<string, unknown> | undefined,
  name: (key: string) => string | null,
): Record<string, unknown> | undefined {
  const closed = VOCABULARIES[code];
  if (!params || !closed) return params;

  const named = { ...params };

  for (const param of closed) {
    const values = named[param];
    if (!Array.isArray(values)) continue;

    named[param] = values.map((value) =>
      typeof value === 'string' ? (name(`${code}.${value}`) ?? value) : value,
    );
  }

  return named;
}

/**
 * The params the catalogue types as `timestamp`.
 *
 * By name, because `params` is untyped on the wire and a string that merely
 * looks like a date is not one — an id, a filename, a headline could all parse.
 * The catalogue is the authority on which keys carry an instant, so the list
 * moves when it does.
 */
const TIMESTAMP_PARAMS = new Set(['resetsAt']);

function toIcuValue(key: string, value: unknown, locale: string): IcuValue {
  if (Array.isArray(value)) return formatList(value, locale);

  if (TIMESTAMP_PARAMS.has(key) && typeof value === 'string') {
    const parsed = new Date(value);
    // A value the server should not have sent. Falling through to the string
    // keeps the sentence readable rather than printing "Invalid Date".
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value instanceof Date) return value;

  // Booleans, nulls, and anything a future code introduces. Stringifying is
  // not a great rendering, but the alternative is a message that silently
  // becomes its own key (next-intl swallows a bad value that way rather than
  // throwing), and a visible `true` beats `errors.COMPILATION_FAILED`.
  return String(value);
}

export function formatErrorParams(
  params: Record<string, unknown> | undefined,
  locale: string,
): Record<string, IcuValue> {
  if (!params) return {};

  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, toIcuValue(key, value, locale)]),
  );
}
