/**
 * Dates on screen, through `Intl` (rule 9).
 *
 * This is the **editor's** formatting, so it follows the interface language:
 * a Turkish interface says "Nis 2022" about an English CV, because the person
 * reading the editor is the user, not the recruiter. Dates rendered *inside* a
 * generated CV follow the content language instead and are the server's job —
 * do not reach for this there.
 */

/** `2022-04-01` → year, month, day. `undefined` if it is not that shape. */
function parts(iso: string): [number, number, number] | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * A wire date as a month and year the reader can read.
 *
 * Built and formatted in **UTC**, deliberately. `new Date('2022-04-01')` is
 * parsed as UTC midnight, and rendering that in any timezone behind UTC moves
 * it to the previous day — which for the first of a month is the previous
 * *month*, so a job that started in April is shown as starting in March. The
 * wire value carries no time and no zone, so treating it as one point in UTC
 * is the only reading that survives the trip.
 *
 * Returns `undefined` rather than throwing or inventing a date: an unparseable
 * value means the heading omits the range, which is worse than a date and far
 * better than a wrong one.
 */
export function formatMonthYear(iso: string, locale: string): string | undefined {
  const parsed = parts(iso);
  if (!parsed) return undefined;

  const [year, month, day] = parsed;
  const date = new Date(Date.UTC(year, month - 1, day));

  // Round-tripped rather than range-checked. `Date.UTC` rolls over silently —
  // month 13 becomes January of the next year, 31 February becomes March —
  // and every one of those is a plausible-looking date that is not the one
  // that was sent. Comparing the parts back out catches the whole family,
  // including the leap-year cases a hand-written range check gets wrong.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}
