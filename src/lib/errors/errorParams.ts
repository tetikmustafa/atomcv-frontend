/**
 * Prepares an error's `params` for ICU interpolation.
 *
 * Numbers and strings go straight through — ICU formats them itself, which is
 * the whole reason the catalogue publishes types (`{pinnedPages, number}`
 * formats, `{pinnedPages}` merely substitutes).
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

function toIcuValue(value: unknown, locale: string): IcuValue {
  if (Array.isArray(value)) return formatList(value, locale);
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
    Object.entries(params).map(([key, value]) => [key, toIcuValue(value, locale)]),
  );
}
